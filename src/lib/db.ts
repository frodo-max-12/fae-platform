import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      googleTokens TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      model TEXT NOT NULL,
      series TEXT NOT NULL,
      sensing TEXT NOT NULL,
      ipRating TEXT NOT NULL,
      tempRange TEXT NOT NULL,
      output TEXT NOT NULL,
      voltage TEXT NOT NULL,
      price REAL NOT NULL,
      moq INTEGER NOT NULL,
      warranty TEXT NOT NULL,
      stock INTEGER NOT NULL,
      warehouse TEXT NOT NULL,
      advantages TEXT NOT NULL,
      UNIQUE(company, model)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_cache (
      cacheKey TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      userId TEXT,
      customerId TEXT,
      rawEmail TEXT,
      extractedSpecs TEXT,
      productId TEXT,
      stockResult TEXT,
      comparison TEXT,
      emailDraft TEXT,
      finalEmail TEXT,
      status TEXT DEFAULT 'intake',
      sentAt TEXT,
      totalTime INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (customerId) REFERENCES customers(id)
    );
  `);
}

// ── Helpers ──

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── User queries ──

export function upsertUser(email: string, name: string, googleTokens?: string) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE users SET name = ?, googleTokens = ?, updatedAt = datetime('now') WHERE id = ?")
      .run(name, googleTokens || null, existing.id);
    return existing.id;
  }
  const id = genId();
  db.prepare("INSERT INTO users (id, email, name, googleTokens) VALUES (?, ?, ?, ?)")
    .run(id, email, name, googleTokens || null);
  return id;
}

export function getUserById(id: string) {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
}

// ── Product queries ──

export function getAllProducts() {
  return getDb().prepare("SELECT * FROM products ORDER BY company, model").all();
}

export function getProductByModel(model: string) {
  return getDb().prepare("SELECT * FROM products WHERE model = ?").get(model);
}

export function getProductById(id: string) {
  return getDb().prepare("SELECT * FROM products WHERE id = ?").get(id);
}

export function upsertProduct(p: {
  company: string; model: string; series: string; sensing: string;
  ipRating: string; tempRange: string; output: string; voltage: string;
  price: number; moq: number; warranty: string;
  stock: number; warehouse: string; advantages: string;
}) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM products WHERE company = ? AND model = ?").get(p.company, p.model) as { id: string } | undefined;
  if (existing) {
    db.prepare(`UPDATE products SET series=?, sensing=?, ipRating=?, tempRange=?, output=?, voltage=?,
      price=?, moq=?, warranty=?, stock=?, warehouse=?, advantages=? WHERE id=?`)
      .run(p.series, p.sensing, p.ipRating, p.tempRange, p.output, p.voltage,
        p.price, p.moq, p.warranty, p.stock, p.warehouse, p.advantages, existing.id);
    return existing.id;
  }
  const id = genId();
  db.prepare(`INSERT INTO products (id, company, model, series, sensing, ipRating, tempRange, output, voltage,
    price, moq, warranty, stock, warehouse, advantages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, p.company, p.model, p.series, p.sensing, p.ipRating, p.tempRange, p.output, p.voltage,
      p.price, p.moq, p.warranty, p.stock, p.warehouse, p.advantages);
  return id;
}

// ── Match cache queries (24h TTL) ──

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function getCached(key: string): unknown | null {
  const row = getDb().prepare("SELECT payload, createdAt FROM match_cache WHERE cacheKey = ?").get(key) as { payload: string; createdAt: number } | undefined;
  if (!row) return null;
  if (Date.now() - row.createdAt > CACHE_TTL_MS) {
    getDb().prepare("DELETE FROM match_cache WHERE cacheKey = ?").run(key);
    return null;
  }
  try { return JSON.parse(row.payload); } catch { return null; }
}

export function setCached(key: string, payload: unknown) {
  getDb().prepare("INSERT OR REPLACE INTO match_cache (cacheKey, payload, createdAt) VALUES (?, ?, ?)")
    .run(key, JSON.stringify(payload), Date.now());
}

// ── Customer queries ──

export function upsertCustomer(name: string, email: string, company: string) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM customers WHERE email = ? AND company = ?").get(email, company) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE customers SET name = ? WHERE id = ?").run(name, existing.id);
    return existing.id;
  }
  const id = genId();
  db.prepare("INSERT INTO customers (id, name, email, company) VALUES (?, ?, ?, ?)").run(id, name, email, company);
  return id;
}

// ── Request queries ──

export function createRequest(data: {
  userId?: string; rawEmail: string; status?: string;
}) {
  const db = getDb();
  const id = genId();
  db.prepare("INSERT INTO requests (id, userId, rawEmail, status) VALUES (?, ?, ?, ?)")
    .run(id, data.userId || null, data.rawEmail, data.status || "intake");
  return id;
}

export function updateRequest(id: string, fields: Record<string, unknown>) {
  const db = getDb();
  const allowed = ["customerId", "extractedSpecs", "productId", "stockResult",
    "comparison", "emailDraft", "finalEmail", "status", "sentAt", "totalTime"];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in fields) {
      updates.push(`${key} = ?`);
      values.push(typeof fields[key] === "object" ? JSON.stringify(fields[key]) : fields[key]);
    }
  }
  if (updates.length === 0) return;
  updates.push("updatedAt = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE requests SET ${updates.join(", ")} WHERE id = ?`).run(...values);
}

export function getRequestById(id: string) {
  return getDb().prepare("SELECT * FROM requests WHERE id = ?").get(id);
}

export function getRecentRequests(limit = 20) {
  return getDb().prepare(
    `SELECT r.*, c.name as customerName, c.company as customerCompany
     FROM requests r LEFT JOIN customers c ON r.customerId = c.id
     ORDER BY r.createdAt DESC LIMIT ?`
  ).all(limit);
}

export function getRequestStats() {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as count FROM requests").get() as { count: number }).count;
  const sent = (db.prepare("SELECT COUNT(*) as count FROM requests WHERE status = 'sent'").get() as { count: number }).count;
  const today = (db.prepare("SELECT COUNT(*) as count FROM requests WHERE date(createdAt) = date('now')").get() as { count: number }).count;
  const avgTime = (db.prepare("SELECT AVG(totalTime) as avg FROM requests WHERE totalTime IS NOT NULL").get() as { avg: number | null }).avg;
  return { total, sent, today, avgTime: avgTime ? Math.round(avgTime) : 0 };
}
