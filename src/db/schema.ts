/**
 * SQLite schema + migrations.
 */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS notes (
  path TEXT PRIMARY KEY,
  title TEXT,
  zk_id TEXT,
  type TEXT,
  status TEXT,
  folder TEXT,
  tags TEXT,
  summary TEXT,
  created TEXT,
  modified TEXT,
  content_hash TEXT
);

CREATE TABLE IF NOT EXISTS links (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  link_type TEXT,
  PRIMARY KEY (source, target)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_zk_id ON notes(zk_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target);
`;
