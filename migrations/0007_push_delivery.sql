-- Delivery diagnostics contain classification codes only, never payloads or keys.
ALTER TABLE push_jobs ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_jobs ADD COLUMN failure_code TEXT;
ALTER TABLE push_jobs ADD COLUMN accepted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_jobs ADD COLUMN failed_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX push_jobs_due ON push_jobs(status,next_attempt_at,created_at);
