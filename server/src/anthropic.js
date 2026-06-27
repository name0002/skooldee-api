// Thin wrapper around the Claude Messages API for the chat assistant.
// Uses Haiku — cheapest model in the family — since both chat surfaces are
// scoped, short-answer Q&A, not open-ended reasoning.
const MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * @param {string} system - system prompt (scope/knowledge for this chat surface)
 * @param {{role: 'user'|'assistant', content: string}[]} messages - conversation turns
 * @param {number} maxTokens - cap on response length (keep this small to control cost)
 * @returns {Promise<{ text: string, tokensIn: number, tokensOut: number }>}
 */
export async function askClaude(system, messages, maxTokens = 350) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('chat is not configured');
    err.status = 503;
    throw err;
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`claude api error: ${res.status} ${detail.slice(0, 200)}`);
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || '').join('').trim();
  return {
    text: text || 'ขออภัยค่ะ ตอบคำถามนี้ไม่ได้ในขณะนี้ ลองถามใหม่อีกครั้งนะคะ',
    tokensIn: data.usage?.input_tokens ?? null,
    tokensOut: data.usage?.output_tokens ?? null,
  };
}
