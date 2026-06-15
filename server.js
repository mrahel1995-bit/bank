// ════════════════════════════════════════════════
//  النظام المالي الموحد — server.js
//  Express + JWT + PostgreSQL
// ════════════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const { Pool }   = require('pg');
const path       = require('path');
const cors       = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── إعداد PostgreSQL ──────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// اختبار الاتصال بقاعدة البيانات عند التشغيل
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
  } else {
    console.log('✅ متصل بقاعدة البيانات PostgreSQL');
    release();
    initDB(); // تهيئة الجداول
  }
});

// ── تهيئة الجداول ─────────────────────────────────
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id          SERIAL PRIMARY KEY,
        source      VARCHAR(50)    NOT NULL,
        name        TEXT,
        recv        NUMERIC(12,2),
        paid        NUMERIC(12,2),
        date        DATE,
        time        VARCHAR(10),
        description TEXT,
        bank_date   DATE,
        actual_date DATE,
        haq_date    DATE,
        file_name   TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customers (
        id         SERIAL PRIMARY KEY,
        name       TEXT UNIQUE NOT NULL,
        phone      VARCHAR(20),
        notes      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bank_identity (
        id          SERIAL PRIMARY KEY,
        source      VARCHAR(50) NOT NULL,
        bank_name   TEXT        NOT NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source, bank_name)
      );
    `);
    console.log('✅ الجداول جاهزة');
  } catch (err) {
    console.error('❌ خطأ في تهيئة الجداول:', err.message);
  }
}

// ── Middleware ────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ══════════════════════════════════════════════════
//  API: الحركات (Transactions)
// ══════════════════════════════════════════════════

// جلب الحركات
app.get('/api/transactions', async (req, res) => {
  try {
    const { source, name, from, to, limit = 500, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;

    if (source) { conditions.push(`source = $${p++}`); params.push(source); }
    if (name)   { conditions.push(`name ILIKE $${p++}`); params.push(`%${name}%`); }
    if (from)   { conditions.push(`date >= $${p++}`); params.push(from); }
    if (to)     { conditions.push(`date <= $${p++}`); params.push(to); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = await pool.query(
      `SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM transactions ${where}`, params);
    res.json({ ok: true, data: rows.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة حركات (batch)
app.post('/api/transactions/batch', async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || !transactions.length) {
    return res.status(400).json({ error: 'لا توجد حركات للإضافة' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    for (const tx of transactions) {
      await client.query(`
        INSERT INTO transactions (source, name, recv, paid, date, time, description, bank_date, actual_date, haq_date, file_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        tx.source, tx.name,
        tx.recv   || null, tx.paid || null,
        tx.date   || null, tx.time || null,
        tx.raw    || null,
        tx.bankDate   || null,
        tx.actualDate || null,
        tx.haqDate    || null,
        tx.fileName   || null
      ]);
      inserted++;
    }
    await client.query('COMMIT');
    res.json({ ok: true, inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// حذف الحركات
app.delete('/api/transactions', async (req, res) => {
  try {
    const { source } = req.query;
    if (source) {
      await pool.query('DELETE FROM transactions WHERE source = $1', [source]);
    } else {
      await pool.query('DELETE FROM transactions');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  API: العملاء (Customers)
// ══════════════════════════════════════════════════

app.get('/api/customers', async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const { name, phone, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
  try {
    const result = await pool.query(
      'INSERT INTO customers (name, phone, notes) VALUES ($1,$2,$3) ON CONFLICT (name) DO UPDATE SET phone=$2, notes=$3 RETURNING *',
      [name, phone || null, notes || null]
    );
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  API: السجل الدائم (Bank Identity)
// ══════════════════════════════════════════════════

app.get('/api/bank-identity', async (req, res) => {
  try {
    const rows = await pool.query(`
      SELECT bi.*, c.name AS customer_name
      FROM bank_identity bi
      LEFT JOIN customers c ON c.id = bi.customer_id
      ORDER BY bi.source, bi.bank_name
    `);
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bank-identity', async (req, res) => {
  const { source, bank_name, customer_id } = req.body;
  if (!source || !bank_name) return res.status(400).json({ error: 'المصدر والاسم مطلوبان' });
  try {
    const result = await pool.query(`
      INSERT INTO bank_identity (source, bank_name, customer_id)
      VALUES ($1,$2,$3)
      ON CONFLICT (source, bank_name) DO UPDATE SET customer_id=$3
      RETURNING *
    `, [source, bank_name, customer_id || null]);
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── صفحة الـ Ping لإبقاء Render مستيقظاً ─────────
app.get('/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── الصفحة الرئيسية (بدون حماية) ──────────────────
app.use('/', express.static(path.join(__dirname, 'public')));

// إعادة توجيه المسارات غير المعروفة للـ index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── تشغيل الخادم ──────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
  console.log(`🌍 البيئة: ${process.env.NODE_ENV || 'development'}`);
});
