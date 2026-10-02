ALTER TABLE photo_uploads ADD COLUMN thumbnail_path TEXT;
ALTER TABLE photo_uploads ADD COLUMN detached_at INTEGER;
ALTER TABLE attachments ADD COLUMN thumbnail_path TEXT;
CREATE TABLE object_gc(object_path TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
