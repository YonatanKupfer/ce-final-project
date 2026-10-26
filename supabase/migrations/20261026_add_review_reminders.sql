-- Track academic-advisor reminder emails sent for a proposal awaiting revision.
ALTER TABLE projects
  ADD COLUMN review_reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_review_reminder_sent_at TIMESTAMPTZ;
