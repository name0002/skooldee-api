// Small helpers shared by routes.

// Turn a thrown error into a clean 4xx/5xx JSON response.
function sendError(res, err) {
  if (res.headersSent) return; // a response already went out — nothing safe to do
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'server error' });
}

// Wrap an (req,res) handler so thrown errors become clean 400/500 responses.
// Handles BOTH sync handlers and async handlers: an async handler returns a
// promise, so we must also attach a .catch — otherwise a throw after the first
// await becomes an unhandled rejection (no response sent + can crash the process).
export const wrap = (fn) => (req, res) => {
  try {
    const out = fn(req, res);
    if (out && typeof out.then === 'function') out.catch((err) => sendError(res, err));
  } catch (err) {
    sendError(res, err);
  }
};

export function bad(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Require given fields to be present (non-empty) on body; returns them.
export function required(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      throw bad(`field '${f}' is required`);
    }
  }
  return body;
}

export const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const today = () => new Date().toISOString().slice(0, 10);
