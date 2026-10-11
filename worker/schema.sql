CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Created on demand by the Worker too (worker/index.ts), listed here for reference and local setup.
CREATE TABLE IF NOT EXISTS explain_cache (key TEXT PRIMARY KEY, text TEXT NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS explain_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL);
