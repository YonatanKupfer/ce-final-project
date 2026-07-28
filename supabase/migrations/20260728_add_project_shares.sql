-- External project sharing: send a project to a non-admin person for read-only
-- review + comments, via an unauthenticated token link (mirrors edit_token /
-- approval_token pattern already used for projects/registrations).

CREATE TABLE project_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT uuid_generate_v4(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  admin_note TEXT,
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_project_shares_token ON project_shares(token);
CREATE INDEX idx_project_shares_project_id ON project_shares(project_id);

CREATE TABLE project_share_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id UUID NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL CHECK (length(trim(comment_text)) > 0),
  author_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_share_comments_share_id ON project_share_comments(share_id);

-- RLS enabled, no permissive policies: both the admin flow and the external
-- token flow go exclusively through API routes using the service-role client,
-- never the browser Supabase client, so no "anyone" policies are needed here.
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_share_comments ENABLE ROW LEVEL SECURITY;
