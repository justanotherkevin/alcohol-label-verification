-- Drop in dependency order (children before parents)
DROP TABLE IF EXISTS resolutions CASCADE;
DROP TABLE IF EXISTS field_notes CASCADE;
DROP TABLE IF EXISTS review_sessions CASCADE;
DROP TABLE IF EXISTS ocr_data CASCADE;
DROP TABLE IF EXISTS application_images CASCADE;
DROP TABLE IF EXISTS application_data CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS batch_runs CASCADE;

CREATE TABLE applications (
  id           TEXT PRIMARY KEY,
  applicant    TEXT        NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL
);

CREATE TABLE application_data (
  application_id     TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  brand_name         TEXT,
  class_type         TEXT,
  abv                TEXT,
  net_contents       TEXT,
  bottler            TEXT,
  country_of_origin  TEXT,
  government_warning TEXT
);

CREATE TABLE application_images (
  id             SERIAL PRIMARY KEY,
  application_id TEXT        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  position       INTEGER     NOT NULL,
  image_path     TEXT        NOT NULL,
  mime_type      TEXT        NOT NULL,
  side           TEXT,
  raw_ocr_text   TEXT
);

CREATE TABLE ocr_data (
  application_image_id INTEGER     PRIMARY KEY REFERENCES application_images(id) ON DELETE CASCADE,
  data                 JSONB       NOT NULL,
  analyzed_at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE review_sessions (
  id             SERIAL PRIMARY KEY,
  application_id TEXT        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  specialist_id  TEXT        NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL,
  completed_at   TIMESTAMPTZ
);

CREATE TABLE field_notes (
  id             SERIAL PRIMARY KEY,
  application_id TEXT        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field          TEXT        NOT NULL,
  note           TEXT        NOT NULL,
  flagged        BOOLEAN     NOT NULL,
  decision       TEXT,
  specialist_id  TEXT        NOT NULL,
  saved_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE resolutions (
  application_id  TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  decision        TEXT        NOT NULL,
  overrides       JSONB       NOT NULL,
  rejected_fields JSONB       NOT NULL,
  note            TEXT        NOT NULL,
  resolved_at     TIMESTAMPTZ NOT NULL,
  specialist_id   TEXT
);

CREATE TABLE batch_runs (
  id             SERIAL PRIMARY KEY,
  triggered_by   TEXT        NOT NULL, -- 'cron' | 'manual'
  analyzed_count INTEGER     NOT NULL,
  completed_at   TIMESTAMPTZ NOT NULL
);
