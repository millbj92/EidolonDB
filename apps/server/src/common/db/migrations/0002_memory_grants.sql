CREATE TYPE IF NOT EXISTS grant_permission AS ENUM ('read', 'read-write');

CREATE TABLE IF NOT EXISTS memory_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  owner_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  grantee_entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  permission grant_permission NOT NULL DEFAULT 'read',
  scope_tier memory_tier,
  scope_tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_grants_tenant_idx ON memory_grants (tenant_id);
CREATE INDEX IF NOT EXISTS memory_grants_owner_idx ON memory_grants (owner_entity_id);
CREATE INDEX IF NOT EXISTS memory_grants_grantee_idx ON memory_grants (grantee_entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS memory_grants_unique_scope_idx
  ON memory_grants (
    tenant_id,
    owner_entity_id,
    COALESCE(grantee_entity_id::text, '__all__'),
    COALESCE(scope_tier::text, '__all__'),
    COALESCE(scope_tag, '__all__')
  );
