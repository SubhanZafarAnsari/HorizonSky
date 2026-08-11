const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'horizonsky.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    from_city TEXT,
    to_city TEXT,
    depart_date TEXT,
    return_date TEXT,
    passengers TEXT
  );
`);

function insertLead(lead) {
  const stmt = db.prepare(`
    INSERT INTO leads
      (from_city, to_city, depart_date, return_date, passengers, name, email, phone, country_code, hotel_needed, quoted_price, is_valid, invalid_field, invalid_reason, invalid_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    lead.from_city || null,
    lead.to_city || null,
    lead.depart_date || null,
    lead.return_date || null,
    lead.passengers || null,
    lead.name || null,
    lead.email || null,
    lead.phone || null,
    lead.country_code || null,
    lead.hotel_needed ? 1 : 0,
    lead.quoted_price || null,
    lead.is_valid ? 1 : 0,
    lead.invalid_field || null,
    lead.invalid_reason || null,
    lead.invalid_value || null
  );
  return info.lastInsertRowid;
}

function insertSearch(search) {
  const stmt = db.prepare(`
    INSERT INTO searches (from_city, to_city, depart_date, return_date, passengers)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    search.from_city || null,
    search.to_city || null,
    search.depart_date || null,
    search.return_date || null,
    search.passengers || null
  );
  return info.lastInsertRowid;
}

function getAllLeads() {
  return db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
}

function getLeadById(id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function getStats() {
  const totalLeads = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const invalidLeads = db.prepare('SELECT COUNT(*) as c FROM leads WHERE is_valid = 0').get().c;
  const totalSearches = db.prepare('SELECT COUNT(*) as c FROM searches').get().c;
  return { totalLeads, invalidLeads, totalSearches };
}

module.exports = { db, insertLead, insertSearch, getAllLeads, getLeadById, getStats };
