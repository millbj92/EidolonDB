ALTER TABLE memories ADD COLUMN IF NOT EXISTS conflict_status text DEFAULT 'none';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS conflict_group_id uuid;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS conflict_resolution text;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS memories_conflict_status_idx ON memories(tenant_id, conflict_status);
