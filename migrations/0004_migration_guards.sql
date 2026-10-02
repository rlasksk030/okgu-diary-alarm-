CREATE TABLE migration_applies(id TEXT PRIMARY KEY,valid INTEGER NOT NULL CHECK(valid=1),applied_at INTEGER NOT NULL);
