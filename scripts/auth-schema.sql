-- Better-Auth v1 SQLite schema (user/session/account/verification)

CREATE TABLE IF NOT EXISTS user (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  emailVerified  INTEGER NOT NULL DEFAULT 0,
  image          TEXT,
  createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session (
  id         TEXT PRIMARY KEY,
  userId     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expiresAt  TEXT NOT NULL,
  ipAddress  TEXT,
  userAgent  TEXT,
  createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_user ON session(userId);

CREATE TABLE IF NOT EXISTS account (
  id                       TEXT PRIMARY KEY,
  userId                   TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accountId                TEXT NOT NULL,
  providerId               TEXT NOT NULL,
  accessToken              TEXT,
  refreshToken             TEXT,
  idToken                  TEXT,
  accessTokenExpiresAt     TEXT,
  refreshTokenExpiresAt    TEXT,
  scope                    TEXT,
  password                 TEXT,
  createdAt                TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_account_user     ON account(userId);
CREATE INDEX IF NOT EXISTS idx_account_provider ON account(providerId, accountId);

CREATE TABLE IF NOT EXISTS verification (
  id          TEXT PRIMARY KEY,
  identifier  TEXT NOT NULL,
  value       TEXT NOT NULL,
  expiresAt   TEXT NOT NULL,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);

-- Rebuild `exercise` with user_id (previously UNIQUE(name) globally, now UNIQUE(user_id, name)).
CREATE TABLE IF NOT EXISTS exercise_new (
  id           INTEGER PRIMARY KEY,
  user_id      TEXT REFERENCES user(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category_id  INTEGER NOT NULL REFERENCES category(id),
  notes        TEXT,
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, name)
);

INSERT OR IGNORE INTO exercise_new (id, user_id, name, category_id, notes, is_favorite)
  SELECT id, NULL, name, category_id, notes, is_favorite FROM exercise;

DROP TABLE exercise;
ALTER TABLE exercise_new RENAME TO exercise;
CREATE INDEX IF NOT EXISTS idx_exercise_category ON exercise(category_id);
CREATE INDEX IF NOT EXISTS idx_exercise_user     ON exercise(user_id);

-- Rebuild `workout_comment` (was UNIQUE(date) globally, now UNIQUE(user_id, date)).
CREATE TABLE IF NOT EXISTS workout_comment_new (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT REFERENCES user(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  body     TEXT NOT NULL,
  UNIQUE(user_id, date)
);

INSERT INTO workout_comment_new (id, user_id, date, body)
  SELECT id, NULL, date, body FROM workout_comment;

DROP TABLE workout_comment;
ALTER TABLE workout_comment_new RENAME TO workout_comment;
CREATE INDEX IF NOT EXISTS idx_comment_user_date ON workout_comment(user_id, date);

-- Add user_id to training_set (no unique constraints to worry about).
ALTER TABLE training_set ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_set_user_date ON training_set(user_id, date);

-- Rebuild body_weight (was PRIMARY KEY(date) globally, now PRIMARY KEY(user_id, date)).
CREATE TABLE IF NOT EXISTS body_weight_new (
  user_id    TEXT REFERENCES user(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  weight_kg  REAL NOT NULL,
  PRIMARY KEY (user_id, date)
);

INSERT INTO body_weight_new (user_id, date, weight_kg)
  SELECT NULL, date, weight_kg FROM body_weight;

DROP TABLE body_weight;
ALTER TABLE body_weight_new RENAME TO body_weight;
