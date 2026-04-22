-- Gym tracker schema. SQLite / libSQL compatible.

CREATE TABLE IF NOT EXISTS category (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercise (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL REFERENCES category(id),
  notes       TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_exercise_category ON exercise(category_id);

CREATE TABLE IF NOT EXISTS training_set (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id         INTEGER NOT NULL REFERENCES exercise(id),
  date                TEXT NOT NULL,          -- YYYY-MM-DD
  weight_kg           REAL NOT NULL DEFAULT 0,
  reps                INTEGER NOT NULL DEFAULT 0,
  distance_m          REAL NOT NULL DEFAULT 0,
  duration_seconds    INTEGER NOT NULL DEFAULT 0,
  is_personal_record  INTEGER NOT NULL DEFAULT 0,
  position            INTEGER NOT NULL DEFAULT 0,   -- order within the day/exercise
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_set_date     ON training_set(date);
CREATE INDEX IF NOT EXISTS idx_set_exercise ON training_set(exercise_id, date);

CREATE TABLE IF NOT EXISTS workout_comment (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  date   TEXT NOT NULL UNIQUE,
  body   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS body_weight (
  date       TEXT PRIMARY KEY,
  weight_kg  REAL NOT NULL
);
