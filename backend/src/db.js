const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function createDb(dbPath) {
  const db = new DatabaseSync(dbPath || ':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  initSchema(db);
  migrate(db);
  // Convenience wrapper: normalise lastInsertRowid to Number
  return wrap(db);
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'Member',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id    INTEGER NOT NULL REFERENCES users(id),
      title       TEXT NOT NULL,
      description TEXT,
      goal        TEXT NOT NULL,
      duration    INTEGER NOT NULL,
      datetime    TEXT NOT NULL,
      location    TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meeting_attendees (
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (meeting_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS agenda_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id  INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT,
      duration    INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id          INTEGER REFERENCES meetings(id),
      topic               TEXT NOT NULL,
      goal                TEXT NOT NULL,
      duration            INTEGER NOT NULL,
      attendee_count      INTEGER NOT NULL,
      score               INTEGER NOT NULL,
      focus_score         INTEGER NOT NULL,
      collaboration_score INTEGER NOT NULL,
      time_score          INTEGER NOT NULL,
      balance_score       INTEGER NOT NULL,
      key_topics          TEXT,
      factors             TEXT,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id      INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
      type             TEXT NOT NULL,
      is_primary       INTEGER NOT NULL DEFAULT 0,
      proposed_duration INTEGER,
      reasoning        TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      type       TEXT NOT NULL,
      message    TEXT NOT NULL,
      read       INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function migrate(db) {
  // Add role column to users if it doesn't exist (for existing DBs)
  try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Member'"); } catch (_) {}
}

// Thin wrapper so callers get the same API as before,
// with lastInsertRowid always as a plain Number.
function wrap(db) {
  return {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        run:  (...args) => {
          const r = stmt.run(...args);
          return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
        },
        get:  (...args) => stmt.get(...args),
        all:  (...args) => stmt.all(...args),
      };
    },
    close: () => db.close?.(),
  };
}

let _db;
function getDb() {
  if (!_db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'mm.db');
    _db = createDb(dbPath);
  }
  return _db;
}

module.exports = { createDb, getDb };
