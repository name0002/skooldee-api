import { Router } from 'express';
import crypto from 'node:crypto';
import { run } from '../db.js';
import { requireAuth } from '../auth.js';
import { wrap, bad } from '../util.js';
import { rateLimit } from '../rateLimit.js';
import { askClaude } from '../anthropic.js';
import { LANDING_SYSTEM_PROMPT } from '../chat/landingKnowledge.js';
import { APP_HELP_SYSTEM_PROMPT } from '../chat/appHelpKnowledge.js';

const router = Router();

const MAX_TURNS = 8;       // client-side history cap we accept
const MAX_LEN = 2000;      // chars per message

// Validate the `messages` the client sends (it carries its own short history —
// we never reconstruct context from chat_logs; that table is for logging/cost
// visibility only).
function readMessages(body) {
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) throw bad('messages is required');
  if (messages.length > MAX_TURNS) throw bad('too many messages');
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) throw bad('invalid message role');
    if (typeof m.content !== 'string' || !m.content.trim()) throw bad('invalid message content');
    if (m.content.length > MAX_LEN) throw bad('message too long');
  }
  const last = messages[messages.length - 1];
  if (last.role !== 'user') throw bad('last message must be from the user');
  return messages;
}

const logTurn = (schoolId, source, sessionId, role, content, tokensIn, tokensOut) => {
  run(
    `INSERT INTO chat_logs (school_id, source, session_id, role, content, tokens_in, tokens_out)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    schoolId, source, sessionId, role, content, tokensIn, tokensOut
  );
};

// POST /api/public/chat — landing-page presale FAQ. No auth, no DB read access for
// the model; rate-limited per IP since callers are anonymous.
router.post('/public', rateLimit({ windowMs: 60 * 60 * 1000, max: 15, key: (req) => req.ip }),
  wrap(async (req, res) => {
    const messages = readMessages(req.body);
    const sessionId = typeof req.body.sessionId === 'string' && req.body.sessionId
      ? req.body.sessionId
      : crypto.randomUUID();

    const { text, tokensIn, tokensOut } = await askClaude(LANDING_SYSTEM_PROMPT, messages, 500);

    const lastUser = messages[messages.length - 1];
    logTurn(null, 'landing', sessionId, 'user', lastUser.content, tokensIn, null);
    logTurn(null, 'landing', sessionId, 'assistant', text, null, tokensOut);

    res.json({ reply: text, sessionId });
  }));

// POST /api/chat/help — in-app "how to use skooldee" assistant for logged-in
// staff. Authed; rate-limited per school (generous — these are paying users).
router.post('/help', requireAuth,
  rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 50, key: (req) => `school:${req.schoolId}` }),
  wrap(async (req, res) => {
    const messages = readMessages(req.body);
    const sessionId = typeof req.body.sessionId === 'string' && req.body.sessionId
      ? req.body.sessionId
      : crypto.randomUUID();

    const { text, tokensIn, tokensOut } = await askClaude(APP_HELP_SYSTEM_PROMPT, messages, 500);

    const lastUser = messages[messages.length - 1];
    logTurn(req.schoolId, 'app', sessionId, 'user', lastUser.content, tokensIn, null);
    logTurn(req.schoolId, 'app', sessionId, 'assistant', text, null, tokensOut);

    res.json({ reply: text, sessionId });
  }));

export default router;
