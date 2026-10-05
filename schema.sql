CREATE TABLE IF NOT EXISTS jobs (
 id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
 skills TEXT NOT NULL DEFAULT '', min_experience DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(min_experience BETWEEN 0 AND 60),
 created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE TABLE IF NOT EXISTS candidates (
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
 skills TEXT NOT NULL DEFAULT '', experience DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(experience BETWEEN 0 AND 60),
 resume_text TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New','Review','Interview','Rejected','Hired')),
 created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE INDEX IF NOT EXISTS idx_candidate_email ON candidates(email);
CREATE TABLE IF NOT EXISTS interviews (
 id SERIAL PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES candidates(id), job_id INTEGER NOT NULL REFERENCES jobs(id),
 scheduled_at TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'Video' CHECK(format IN ('Video','Phone','In person')),
 notes TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT 'Scheduled' CHECK(outcome IN ('Scheduled','Completed','Cancelled')),
 created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
