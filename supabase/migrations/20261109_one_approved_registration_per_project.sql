-- A project can be staffed by at most one registration. Enforced in the DB so
-- two approvals racing each other (supervisor link + admin, or two supervisor
-- links) can't both succeed.
CREATE UNIQUE INDEX registrations_one_approved_per_project
  ON registrations (project_id)
  WHERE status = 'approved';
