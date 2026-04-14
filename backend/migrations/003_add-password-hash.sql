-- ============================================================================
-- Migration 003: Add password_hash to users table
-- Enables local authentication with bcrypt in production
-- ============================================================================

ALTER TABLE academy_core.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN academy_core.users.password_hash IS
  'bcrypt hash for local authentication. NULL = SSO-only user.';
