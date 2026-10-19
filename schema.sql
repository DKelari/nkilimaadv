CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  mode TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  matter TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot ON bookings (date, time);
