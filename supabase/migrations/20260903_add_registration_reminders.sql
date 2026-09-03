-- Track advisor/mentor reminder emails sent for a pending registration approval.
ALTER TABLE registrations
  ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_reminder_sent_at TIMESTAMPTZ;
