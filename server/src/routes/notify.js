import { Router } from 'express';
import { wrap, required } from '../util.js';

const r = Router();

/**
 * POST /api/notify/line — send a LINE message to a parent.
 *
 * This is a STUB. To make it real:
 *   1. Create a LINE Official Account + Messaging API channel (developers.line.biz)
 *   2. Put the channel access token in env LINE_CHANNEL_ACCESS_TOKEN
 *   3. Store each parent's LINE userId (from LIFF login / webhook follow event)
 *   4. Replace the body below with a POST to https://api.line.me/v2/bot/message/push
 *
 * Example (uncomment once configured):
 *   await fetch('https://api.line.me/v2/bot/message/push', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json',
 *                Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
 *     body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text: message }] }),
 *   });
 */
r.post('/line', wrap((req, res) => {
  const { message } = required(req.body, ['message']);
  const configured = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!configured) {
    return res.json({
      sent: false,
      simulated: true,
      note: 'LINE not configured — set LINE_CHANNEL_ACCESS_TOKEN to send for real',
      preview: message,
    });
  }
  // TODO: real push call here once token + parent LINE userIds are available.
  res.json({ sent: true, preview: message });
}));

export default r;
