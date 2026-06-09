// Small helpers shared by routes.

// Wrap an (req,res) handler so thrown errors become clean 400/500 responses.
export const wrap = (fn) => (req, res) => {
  try {
    fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || 'server error' });
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
