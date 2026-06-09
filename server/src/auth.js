// Authentication + multi-tenant helpers.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const EXPIRES = process.env.JWT_EXPIRES || '7d';

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
export const verifyPassword = (pw, hash) => bcrypt.compareSync(pw, hash);

export function signToken(user) {
  return jwt.sign(
    { uid: user.id, sid: user.school_id, role: user.role, name: user.name },
    SECRET,
    { expiresIn: EXPIRES }
  );
}

// Require a valid JWT. Attaches req.user = { uid, sid, role, name }.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    req.user = jwt.verify(token, SECRET);
    req.schoolId = req.user.sid; // tenant scope for every query
    next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

// Restrict a route to specific roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}
