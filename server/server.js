// ============================================================
// Wedding RSVP & Guest Wishes API
//
// Minimal Express + SQLite service. Intended to run on 127.0.0.1
// behind an Nginx reverse proxy (see ../deploy/nginx-wedding.conf)
// that terminates TLS and exposes it at /api/* on the same origin
// as the static site. See ../README.md for full deployment steps.
// ============================================================

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'wedding.db');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    attending TEXT NOT NULL,
    meal TEXT NOT NULL,
    note TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS godparent_rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    plus_one TEXT NOT NULL,
    message TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add table_number to rsvps if this DB predates it. SQLite has
// no "ADD COLUMN IF NOT EXISTS", so check pragma table_info first — this
// runs on every boot but is a no-op once the column exists.
const rsvpColumns = db.prepare(`PRAGMA table_info(rsvps)`).all().map((c) => c.name);
if (!rsvpColumns.includes('table_number')) {
  db.exec(`ALTER TABLE rsvps ADD COLUMN table_number TEXT`);
}

const insertRsvp = db.prepare(
  `INSERT INTO rsvps (name, attending, meal, note, ip) VALUES (?, ?, ?, ?, ?)`
);
const insertWish = db.prepare(
  `INSERT INTO wishes (name, message, ip) VALUES (?, ?, ?)`
);
const insertGodparentRsvp = db.prepare(
  `INSERT INTO godparent_rsvps (name, plus_one, message, ip) VALUES (?, ?, ?, ?)`
);
const selectRecentWishes = db.prepare(
  `SELECT name, message, created_at AS createdAt FROM wishes ORDER BY id DESC LIMIT ?`
);
const selectAllRsvps = db.prepare(
  `SELECT id, name, attending, meal, note, table_number AS tableNumber, created_at AS createdAt FROM rsvps ORDER BY id DESC`
);
const selectAllWishes = db.prepare(
  `SELECT name, message, created_at AS createdAt FROM wishes ORDER BY id DESC`
);
const selectAllGodparentRsvps = db.prepare(
  `SELECT name, plus_one AS plusOne, message, created_at AS createdAt FROM godparent_rsvps ORDER BY id DESC`
);
const updateRsvpTableNumber = db.prepare(
  `UPDATE rsvps SET table_number = ? WHERE id = ?`
);
const deleteAllRsvps = db.prepare(`DELETE FROM rsvps`);
const deleteAllWishes = db.prepare(`DELETE FROM wishes`);
const deleteAllGodparentRsvps = db.prepare(`DELETE FROM godparent_rsvps`);

const app = express();

// The API sits behind exactly one reverse proxy (Nginx on the same
// host) — this makes req.ip / X-Forwarded-For resolve correctly for
// rate limiting instead of always seeing 127.0.0.1.
app.set('trust proxy', 1);

// CSP, HSTS, and X-Frame-Options are set once, site-wide, by Nginx
// (see deploy/nginx-wedding.conf) and a matching <meta> tag in
// index.html. They're disabled here so the API's JSON responses
// don't emit a second, possibly conflicting, copy of each header.
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: false,
  frameguard: false
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

function checkOrigin(req, res, next) {
  if (!ALLOWED_ORIGIN) return next();
  const origin = req.get('origin');
  if (origin && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this device. Please try again later.' }
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

function clean(value, maxLen) {
  return String(value ?? '').trim().slice(0, maxLen);
}

const ATTENDING_VALUES = new Set(['Joyfully Accepts', 'Regretfully Declines']);
const MEAL_VALUES = new Set(['No Preference', 'Chicken', 'Beef', 'Fish', 'Vegetarian']);
const PLUS_ONE_VALUES = new Set(['Plus One', 'None']);

function isHoneypotTripped(body) {
  return clean(body['bot-field'], 200).length > 0;
}

app.post('/api/rsvp', checkOrigin, writeLimiter, (req, res) => {
  const body = req.body || {};

  if (isHoneypotTripped(body)) {
    // Silently succeed so bots don't learn their submission was rejected.
    return res.status(201).json({ ok: true });
  }

  const name = clean(body.name, 120);
  const attending = clean(body.attending, 40);
  const meal = clean(body.meal, 40);
  const note = clean(body.note, 1000);

  if (!name || !ATTENDING_VALUES.has(attending)) {
    return res.status(400).json({ error: 'Please fill in your name and whether you can attend.' });
  }

  const safeMeal = MEAL_VALUES.has(meal) ? meal : 'No Preference';

  insertRsvp.run(name, attending, safeMeal, note, req.ip);

  res.status(201).json({ ok: true });
});

app.post('/api/godparents', checkOrigin, writeLimiter, (req, res) => {
  const body = req.body || {};

  if (isHoneypotTripped(body)) {
    return res.status(201).json({ ok: true });
  }

  const name = clean(body.name, 120);
  const plusOne = clean(body.plusOne, 20);
  const message = clean(body.message, 1000);

  if (!name || !PLUS_ONE_VALUES.has(plusOne)) {
    return res.status(400).json({ error: 'Please fill in your name and whether you will bring a plus one.' });
  }

  insertGodparentRsvp.run(name, plusOne, message, req.ip);

  res.status(201).json({ ok: true });
});

app.post('/api/wishes', checkOrigin, writeLimiter, (req, res) => {
  const body = req.body || {};

  if (isHoneypotTripped(body)) {
    return res.status(201).json({ ok: true });
  }

  const name = clean(body.name, 80);
  const message = clean(body.message, 500);

  if (!name || !message) {
    return res.status(400).json({ error: 'Please add your name and a message.' });
  }

  insertWish.run(name, message, req.ip);

  res.status(201).json({ ok: true, name, message });
});

app.get('/api/wishes', readLimiter, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  res.json(selectRecentWishes.all(limit));
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: 'Admin export is not configured.' });
  }
  const supplied = Buffer.from(String(req.query.token || req.get('x-admin-token') || ''));
  const expected = Buffer.from(ADMIN_TOKEN);
  const matches = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (!matches) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  }
  return lines.join('\n');
}

app.get('/api/admin/rsvps.csv', adminLimiter, requireAdmin, (req, res) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="rsvps.csv"');
  res.send(toCsv(selectAllRsvps.all()));
});

app.get('/api/admin/wishes.csv', adminLimiter, requireAdmin, (req, res) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="wishes.csv"');
  res.send(toCsv(selectAllWishes.all()));
});

app.get('/api/admin/godparents.csv', adminLimiter, requireAdmin, (req, res) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="godparent-rsvps.csv"');
  res.send(toCsv(selectAllGodparentRsvps.all()));
});

// JSON versions of the same data, for the /admin dashboard page.
app.get('/api/admin/rsvps', adminLimiter, requireAdmin, (req, res) => {
  res.json(selectAllRsvps.all());
});

app.get('/api/admin/wishes', adminLimiter, requireAdmin, (req, res) => {
  res.json(selectAllWishes.all());
});

app.get('/api/admin/godparents', adminLimiter, requireAdmin, (req, res) => {
  res.json(selectAllGodparentRsvps.all());
});

app.patch('/api/admin/rsvps/:id/table', adminLimiter, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid RSVP id.' });
  }
  const tableNumber = clean((req.body || {}).tableNumber, 20);
  const info = updateRsvpTableNumber.run(tableNumber || null, id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'RSVP not found.' });
  }
  res.json({ ok: true, tableNumber });
});

// Delete-all is a hard, irreversible wipe of one table's guest data.
// Gated the same as every other /api/admin/* route (ADMIN_TOKEN, rate
// limited) — the DELETE method itself is also a mild CSRF deterrent,
// since it can't be triggered by a plain link, image tag, or form post.
app.delete('/api/admin/rsvps', adminLimiter, requireAdmin, (req, res) => {
  const info = deleteAllRsvps.run();
  res.json({ ok: true, deleted: info.changes });
});

app.delete('/api/admin/wishes', adminLimiter, requireAdmin, (req, res) => {
  const info = deleteAllWishes.run();
  res.json({ ok: true, deleted: info.changes });
});

app.delete('/api/admin/godparents', adminLimiter, requireAdmin, (req, res) => {
  const info = deleteAllGodparentRsvps.run();
  res.json({ ok: true, deleted: info.changes });
});

// The dashboard page itself holds no guest data — it's a static shell
// that prompts for the admin token client-side and only then calls the
// protected JSON endpoints above, so serving it needs no auth check.
// It's also not linked from the public site and isn't served from the
// static webroot, so guests have no path to it.
app.get('/admin', readLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/app.js', readLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'app.js'));
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, HOST, () => {
  console.log(`Wedding API listening on http://${HOST}:${PORT}`);
});
