-- ============================================================
-- Migration: Switch from Clerk to Better Auth
-- ============================================================
-- This migration:
-- 1. Renames clerk_id to auth_id
-- 2. Makes auth_id nullable (for pending invites) instead of UNIQUE NOT NULL
-- 3. Keeps all other data intact

BEGIN;

-- Step 1: Drop existing index on clerk_id
DROP INDEX IF EXISTS idx_users_clerk_id;

-- Step 2: Rename clerk_id to auth_id
ALTER TABLE users RENAME COLUMN clerk_id TO auth_id;

-- Step 3: Modify the column to be nullable (for pending invites)
ALTER TABLE users ALTER COLUMN auth_id DROP NOT NULL;

-- Step 4: Create new index on auth_id
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

COMMIT;
