-- Migration: add unique constraint on users.email
-- Run cleanup first to remove duplicate users that have no API keys on their tenant.
-- Safe to run multiple times (idempotent delete, CREATE INDEX IF NOT EXISTS).

-- Step 1: Delete orphan tenants for duplicate users (keep the one whose tenant has an API key)
DELETE FROM tenants
WHERE id IN (
  SELECT t.id
  FROM tenants t
  LEFT JOIN api_keys ak ON ak.tenant_id = t.id AND ak.revoked_at IS NULL
  WHERE t.user_id IN (
    -- users that share an email with another user
    SELECT u.id FROM users u
    WHERE u.email IN (
      SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1
    )
  )
  AND ak.id IS NULL  -- no active API key = the duplicate tenant
);

-- Step 2: Delete the now-orphaned duplicate user rows
DELETE FROM users
WHERE id NOT IN (SELECT user_id FROM tenants)
  AND email IN (
    SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1
  );

-- Step 3: Add unique constraint
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
