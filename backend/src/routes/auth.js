const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'mm-dev-secret';

module.exports = function authRoutes(db) {
  // POST /api/auth/register
  router.post('/register', (req, res) => {
    const { name, email, password, role = 'Member' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = bcrypt.hashSync(password, 10);
    const { lastInsertRowid: id } = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, hash, role);

    const token = jwt.sign({ id, email, name, role }, SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { id, name, email, role }, token });
  });

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  });

  return router;
};
