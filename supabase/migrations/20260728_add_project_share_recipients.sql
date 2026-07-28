-- Support multiple external recipients on the same share/thread. Each
-- comment already snapshots its own author_label, so per-person attribution
-- doesn't need a comment -> recipient foreign key.

CREATE TABLE project_share_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id UUID NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_share_recipients_share_id ON project_share_recipients(share_id);

ALTER TABLE project_share_recipients ENABLE ROW LEVEL SECURITY;

-- Move the existing single recipient per share into the new table, then drop
-- the now-redundant columns from project_shares.
INSERT INTO project_share_recipients (share_id, email, name)
SELECT id, recipient_email, recipient_name FROM project_shares;

ALTER TABLE project_shares DROP COLUMN recipient_email;
ALTER TABLE project_shares DROP COLUMN recipient_name;
