-- Ops scheduling: events, attendees, staff availability, public booking slug

ALTER TABLE ops_staff ADD COLUMN booking_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_staff_booking_slug
  ON ops_staff (booking_slug)
  WHERE booking_slug IS NOT NULL AND booking_slug != '';

CREATE TABLE IF NOT EXISTS schedule_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  status TEXT NOT NULL DEFAULT 'scheduled',
  customer_id INTEGER,
  order_id TEXT,
  location TEXT,
  host_email TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_events_starts_at
  ON schedule_events (starts_at);

CREATE INDEX IF NOT EXISTS idx_schedule_events_status_starts
  ON schedule_events (status, starts_at);

CREATE INDEX IF NOT EXISTS idx_schedule_events_host_starts
  ON schedule_events (host_email, starts_at);

CREATE INDEX IF NOT EXISTS idx_schedule_events_customer
  ON schedule_events (customer_id);

CREATE TABLE IF NOT EXISTS schedule_attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  role TEXT NOT NULL,
  staff_id INTEGER,
  email TEXT NOT NULL,
  name TEXT,
  notify INTEGER NOT NULL DEFAULT 1,
  last_notify_status TEXT,
  last_notify_error TEXT,
  last_notify_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES schedule_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_attendees_event
  ON schedule_attendees (event_id);

CREATE INDEX IF NOT EXISTS idx_schedule_attendees_email
  ON schedule_attendees (email);

CREATE TABLE IF NOT EXISTS schedule_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_email TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  start_minute INTEGER NOT NULL,
  end_minute INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (weekday >= 0 AND weekday <= 6),
  CHECK (start_minute >= 0 AND start_minute < 1440),
  CHECK (end_minute > start_minute AND end_minute <= 1440)
);

CREATE INDEX IF NOT EXISTS idx_schedule_availability_email_day
  ON schedule_availability (staff_email, weekday);
