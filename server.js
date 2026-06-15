const express = require('express')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const app = express()
const PORT = 3000
const JWT_SECRET = process.env.JWT_SECRET || 'raport-sshp-nma-2026-secret'
const DB_PATH = path.join(__dirname, 'data', 'raport.db')
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const FRONTEND_DIR = path.join(__dirname, 'frontend')
const LOCK_HOURS = 12

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// ── Database ──
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    report_number INTEGER NOT NULL,
    report_date TEXT NOT NULL,
    objekti TEXT,
    investitori TEXT,
    realizuesi TEXT,
    vendi TEXT,
    dita TEXT,
    koha_inspektimit TEXT,
    temperatura REAL,
    moti TEXT,
    verejtje TEXT,
    rekomandime TEXT,
    afati TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inspection_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    pika TEXT NOT NULL,
    rendi INTEGER NOT NULL,
    vleresimi TEXT
  );

  CREATE TABLE IF NOT EXISTS documentation_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    teksti TEXT,
    foto_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date);
  CREATE INDEX IF NOT EXISTS idx_points_report ON inspection_points(report_id);
  CREATE INDEX IF NOT EXISTS idx_blocks_report ON documentation_blocks(report_id);
`)

// Seed default admin user if none exists
const existingUser = db.prepare('SELECT id FROM users LIMIT 1').get()
if (!existingUser) {
  const hash = bcrypt.hashSync('admin123', 10)
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash)
  console.log('Default user created: admin / admin123')
}

// ── Multer ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// ── Middleware ──
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))
app.use(express.static(FRONTEND_DIR))

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Nuk jeni të kyçur' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token i pavlefshëm' })
  }
}

function isLocked(createdAt) {
  return Date.now() > new Date(createdAt).getTime() + LOCK_HOURS * 3600 * 1000
}

function nextReportNumber(date) {
  const row = db.prepare('SELECT COALESCE(MAX(report_number), 0) as mx FROM reports WHERE report_date = ?').get(date)
  return (row.mx || 0) + 1
}

// ── Auth routes ──
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Kredenciale të gabuara' })
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, user: { id: user.id, username: user.username } })
})

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username })
})

// ── Reports ──
app.get('/api/reports', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, report_number, report_date, objekti, investitori, vendi, created_at
    FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 200
  `).all(req.user.id)
  res.json(rows)
})

app.post('/api/reports', auth, (req, res) => {
  const { report_date, objekti, investitori, realizuesi, vendi, dita,
    koha_inspektimit, temperatura, moti, verejtje, rekomandime, afati, points } = req.body

  const date = report_date || new Date().toISOString().split('T')[0]
  const rNum = nextReportNumber(date)

  const result = db.prepare(`
    INSERT INTO reports (user_id, report_number, report_date, objekti, investitori, realizuesi,
      vendi, dita, koha_inspektimit, temperatura, moti, verejtje, rekomandime, afati)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, rNum, date, objekti, investitori, realizuesi, vendi, dita,
    koha_inspektimit, temperatura || null, moti, verejtje, rekomandime, afati)

  const reportId = result.lastInsertRowid

  if (points && points.length) {
    const ins = db.prepare('INSERT INTO inspection_points (report_id, pika, rendi, vleresimi) VALUES (?, ?, ?, ?)')
    for (const p of points) ins.run(reportId, p.pika, p.rendi, p.vleresimi || null)
  }

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId)
  res.status(201).json(report)
})

app.get('/api/reports/:id', auth, (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Nuk u gjet' })
  res.json(report)
})

app.put('/api/reports/:id', auth, (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Nuk u gjet' })
  if (isLocked(report.created_at)) return res.status(403).json({ error: 'Raporti është i bllokuar (12h skaduan)' })

  const { objekti, investitori, realizuesi, vendi, dita, report_date,
    koha_inspektimit, temperatura, moti, verejtje, rekomandime, afati, points } = req.body

  db.prepare(`
    UPDATE reports SET objekti=?, investitori=?, realizuesi=?, vendi=?, dita=?, report_date=?,
      koha_inspektimit=?, temperatura=?, moti=?, verejtje=?, rekomandime=?, afati=?,
      updated_at=datetime('now')
    WHERE id = ?
  `).run(objekti, investitori, realizuesi, vendi, dita, report_date,
    koha_inspektimit, temperatura || null, moti, verejtje, rekomandime, afati, req.params.id)

  if (points && points.length) {
    for (const p of points) {
      if (p.id) {
        db.prepare('UPDATE inspection_points SET vleresimi=? WHERE id=? AND report_id=?')
          .run(p.vleresimi || null, p.id, req.params.id)
      } else {
        db.prepare('INSERT INTO inspection_points (report_id, pika, rendi, vleresimi) VALUES (?,?,?,?)')
          .run(req.params.id, p.pika, p.rendi, p.vleresimi || null)
      }
    }
  }

  const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// ── Inspection Points ──
app.get('/api/reports/:id/points', auth, (req, res) => {
  const report = db.prepare('SELECT id FROM reports WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Nuk u gjet' })
  const pts = db.prepare('SELECT * FROM inspection_points WHERE report_id=? ORDER BY rendi').all(req.params.id)
  res.json(pts)
})

// ── Documentation Blocks ──
app.get('/api/reports/:id/blocks', auth, (req, res) => {
  const report = db.prepare('SELECT id FROM reports WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Nuk u gjet' })
  const blocks = db.prepare('SELECT * FROM documentation_blocks WHERE report_id=? ORDER BY created_at').all(req.params.id)
  res.json(blocks)
})

app.post('/api/reports/:id/blocks', auth, (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Nuk u gjet' })
  if (isLocked(report.created_at)) return res.status(403).json({ error: 'I bllokuar' })

  const { teksti, foto_url } = req.body
  const r = db.prepare('INSERT INTO documentation_blocks (report_id, teksti, foto_url) VALUES (?,?,?)').run(req.params.id, teksti || '', foto_url || null)
  const block = db.prepare('SELECT * FROM documentation_blocks WHERE id=?').get(r.lastInsertRowid)
  res.status(201).json(block)
})

app.put('/api/blocks/:id', auth, (req, res) => {
  const block = db.prepare(`
    SELECT b.*, r.created_at as r_created_at FROM documentation_blocks b
    JOIN reports r ON r.id = b.report_id
    WHERE b.id=? AND r.user_id=?
  `).get(req.params.id, req.user.id)
  if (!block) return res.status(404).json({ error: 'Nuk u gjet' })
  if (isLocked(block.r_created_at)) return res.status(403).json({ error: 'I bllokuar' })

  const { teksti, foto_url } = req.body
  db.prepare('UPDATE documentation_blocks SET teksti=?, foto_url=? WHERE id=?')
    .run(teksti ?? block.teksti, foto_url ?? block.foto_url, req.params.id)
  const updated = db.prepare('SELECT * FROM documentation_blocks WHERE id=?').get(req.params.id)
  res.json(updated)
})

app.delete('/api/blocks/:id', auth, (req, res) => {
  const block = db.prepare(`
    SELECT b.*, r.created_at as r_created_at FROM documentation_blocks b
    JOIN reports r ON r.id = b.report_id
    WHERE b.id=? AND r.user_id=?
  `).get(req.params.id, req.user.id)
  if (!block) return res.status(404).json({ error: 'Nuk u gjet' })
  if (isLocked(block.r_created_at)) return res.status(403).json({ error: 'I bllokuar' })

  // Delete photo file if exists
  if (block.foto_url) {
    const fname = path.basename(block.foto_url)
    const fpath = path.join(UPLOADS_DIR, fname)
    if (fs.existsSync(fpath)) fs.unlinkSync(fpath)
  }
  db.prepare('DELETE FROM documentation_blocks WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ── Photo upload ──
app.post('/api/blocks/:id/photo', auth, upload.single('photo'), (req, res) => {
  const block = db.prepare(`
    SELECT b.*, r.created_at as r_created_at FROM documentation_blocks b
    JOIN reports r ON r.id = b.report_id
    WHERE b.id=? AND r.user_id=?
  `).get(req.params.id, req.user.id)
  if (!block) return res.status(404).json({ error: 'Nuk u gjet' })
  if (isLocked(block.r_created_at)) return res.status(403).json({ error: 'I bllokuar' })
  if (!req.file) return res.status(400).json({ error: 'Nuk u ngarkua foto' })

  // Delete old photo
  if (block.foto_url) {
    const old = path.join(UPLOADS_DIR, path.basename(block.foto_url))
    if (fs.existsSync(old)) fs.unlinkSync(old)
  }

  const foto_url = `/uploads/${req.file.filename}`
  db.prepare('UPDATE documentation_blocks SET foto_url=? WHERE id=?').run(foto_url, req.params.id)
  const updated = db.prepare('SELECT * FROM documentation_blocks WHERE id=?').get(req.params.id)
  res.json(updated)
})

// Upload photo for a new block in one step
app.post('/api/reports/:id/blocks/photo', auth, upload.single('photo'), (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Nuk u gjet' })
  if (isLocked(report.created_at)) return res.status(403).json({ error: 'I bllokuar' })

  const foto_url = req.file ? `/uploads/${req.file.filename}` : null
  const teksti = req.body?.teksti || ''
  const r = db.prepare('INSERT INTO documentation_blocks (report_id, teksti, foto_url) VALUES (?,?,?)').run(req.params.id, teksti, foto_url)
  const block = db.prepare('SELECT * FROM documentation_blocks WHERE id=?').get(r.lastInsertRowid)
  res.status(201).json(block)
})

// ── Change password ──
app.put('/api/auth/password', auth, (req, res) => {
  const { current, newPass } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)
  if (!bcrypt.compareSync(current, user.password_hash))
    return res.status(400).json({ error: 'Fjalëkalimi aktual është i gabuar' })
  const hash = bcrypt.hashSync(newPass, 10)
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.user.id)
  res.json({ ok: true })
})

// ── SPA fallback ──
app.get('*', (req, res) => {
  const idx = path.join(FRONTEND_DIR, 'index.html')
  if (fs.existsSync(idx)) res.sendFile(idx)
  else res.status(404).send('Frontend not built yet')
})

app.listen(PORT, () => console.log(`SSHP Raport running on port ${PORT}`))
