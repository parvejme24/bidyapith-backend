-- Trigram indexes for ILIKE '%term%' search.
-- Without these, every search is a full table scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX users_search_trgm_idx ON users
  USING GIN ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);

CREATE INDEX courses_search_trgm_idx ON courses
  USING GIN ((code || ' ' || title) gin_trgm_ops);

-- Partial indexes: 100% of list queries filter deleted_at IS NULL,
-- so the index should only contain live rows. Smaller index, faster scan.
CREATE INDEX users_active_idx ON users (role, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX courses_active_idx ON courses (department_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX offerings_open_idx ON course_offerings (semester_id, status)
  WHERE deleted_at IS NULL;

-- Covering index for the enrollment prerequisite check — the hottest
-- read in the whole system, run once per prerequisite per registration.
CREATE INDEX enrollments_completed_idx ON enrollments (student_id, status)
  INCLUDE (offering_id, grade_point)
  WHERE status = 'COMPLETED';
