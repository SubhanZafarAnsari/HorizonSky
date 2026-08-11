// const path = require('path');
// const { DatabaseSync } = require('node:sqlite');

// const DB_PATH = path.join(__dirname, 'horizonsky.db');
// const db = new DatabaseSync(DB_PATH);

// db.exec(`
//   CREATE TABLE IF NOT EXISTS leads (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     created_at TEXT NOT NULL DEFAULT (datetime('now')),
//     from_city TEXT,
//     to_city TEXT,
//     depart_date TEXT,
//     return_date TEXT,
//     passengers TEXT,
//     name TEXT,
//     email TEXT,
//     phone TEXT,
//     country_code TEXT,
//     hotel_needed INTEGER DEFAULT 0,
//     quoted_price TEXT,
//     is_valid INTEGER DEFAULT 1,
//     invalid_field TEXT,
//     invalid_reason TEXT,
//     invalid_value TEXT
//   );
// `);

// db.exec(`
//   CREATE TABLE IF NOT EXISTS searches (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     created_at TEXT NOT NULL DEFAULT (datetime('now')),
//     from_city TEXT,
//     to_city TEXT,
//     depart_date TEXT,
//     return_date TEXT,
//     passengers TEXT
//   );
// `);

// function insertLead(lead) {
//   const stmt = db.prepare(`
//     INSERT INTO leads
//       (from_city, to_city, depart_date, return_date, passengers, name, email, phone, country_code, hotel_needed, quoted_price, is_valid, invalid_field, invalid_reason, invalid_value)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `);
//   const info = stmt.run(
//     lead.from_city || null,
//     lead.to_city || null,
//     lead.depart_date || null,
//     lead.return_date || null,
//     lead.passengers || null,
//     lead.name || null,
//     lead.email || null,
//     lead.phone || null,
//     lead.country_code || null,
//     lead.hotel_needed ? 1 : 0,
//     lead.quoted_price || null,
//     lead.is_valid ? 1 : 0,
//     lead.invalid_field || null,
//     lead.invalid_reason || null,
//     lead.invalid_value || null
//   );
//   return info.lastInsertRowid;
// }

// function insertSearch(search) {
//   const stmt = db.prepare(`
//     INSERT INTO searches (from_city, to_city, depart_date, return_date, passengers)
//     VALUES (?, ?, ?, ?, ?)
//   `);
//   const info = stmt.run(
//     search.from_city || null,
//     search.to_city || null,
//     search.depart_date || null,
//     search.return_date || null,
//     search.passengers || null
//   );
//   return info.lastInsertRowid;
// }

// function getAllLeads() {
//   return db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
// }

// function getLeadById(id) {
//   return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
// }

// function getStats() {
//   const totalLeads = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
//   const invalidLeads = db.prepare('SELECT COUNT(*) as c FROM leads WHERE is_valid = 0').get().c;
//   const totalSearches = db.prepare('SELECT COUNT(*) as c FROM searches').get().c;
//   return { totalLeads, invalidLeads, totalSearches };
// }

// module.exports = { db, insertLead, insertSearch, getAllLeads, getLeadById, getStats };


const { sql } = require('@vercel/postgres');

// Run this once (safe to call every cold start — IF NOT EXISTS)
async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      from_city TEXT,
      to_city TEXT,
      depart_date TEXT,
      return_date TEXT,
      passengers TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      country_code TEXT,
      hotel_needed INTEGER DEFAULT 0,
      quoted_price TEXT,
      is_valid INTEGER DEFAULT 1,
      invalid_field TEXT,
      invalid_reason TEXT,
      invalid_value TEXT
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS searches (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      from_city TEXT,
      to_city TEXT,
      depart_date TEXT,
      return_date TEXT,
      passengers TEXT
    );
  `;
}

async function insertLead(lead) {
  await initDb();
  const result = await sql`
    INSERT INTO leads
      (from_city, to_city, depart_date, return_date, passengers, name, email, phone, country_code, hotel_needed, quoted_price, is_valid, invalid_field, invalid_reason, invalid_value)
    VALUES
      (${lead.from_city || null}, ${lead.to_city || null}, ${lead.depart_date || null}, ${lead.return_date || null}, ${lead.passengers || null},
       ${lead.name || null}, ${lead.email || null}, ${lead.phone || null}, ${lead.country_code || null},
       ${lead.hotel_needed ? 1 : 0}, ${lead.quoted_price || null}, ${lead.is_valid ? 1 : 0},
       ${lead.invalid_field || null}, ${lead.invalid_reason || null}, ${lead.invalid_value || null})
    RETURNING id
  `;
  return result.rows[0].id;
}

async function insertSearch(search) {
  await initDb();
  const result = await sql`
    INSERT INTO searches (from_city, to_city, depart_date, return_date, passengers)
    VALUES (${search.from_city || null}, ${search.to_city || null}, ${search.depart_date || null}, ${search.return_date || null}, ${search.passengers || null})
    RETURNING id
  `;
  return result.rows[0].id;
}

async function getAllLeads() {
  await initDb();
  const result = await sql`SELECT * FROM leads ORDER BY id DESC`;
  return result.rows;
}

async function getLeadById(id) {
  await initDb();
  const result = await sql`SELECT * FROM leads WHERE id = ${id}`;
  return result.rows[0];
}

async function getStats() {
  await initDb();
  const totalLeads = (await sql`SELECT COUNT(*) as c FROM leads`).rows[0].c;
  const invalidLeads = (await sql`SELECT COUNT(*) as c FROM leads WHERE is_valid = 0`).rows[0].c;
  const totalSearches = (await sql`SELECT COUNT(*) as c FROM searches`).rows[0].c;
  return { totalLeads, invalidLeads, totalSearches };
}

module.exports = { insertLead, insertSearch, getAllLeads, getLeadById, getStats };