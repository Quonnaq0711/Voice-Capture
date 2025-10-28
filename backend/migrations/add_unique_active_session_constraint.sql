-- Migration: Add unique constraint for active sessions
-- Purpose: Ensure only one active session per user at any time
-- Bug Fix: #42 - Race condition in session activation
-- Date: 2025-01-28

-- For PostgreSQL (Staging/Production)
-- Create a partial unique index that only applies to active sessions
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_user
ON chat_sessions(user_id)
WHERE is_active = TRUE;

-- For SQLite (Development)
-- SQLite supports partial indexes since version 3.8.0
-- The same syntax works for SQLite
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_user
-- ON chat_sessions(user_id)
-- WHERE is_active = TRUE;

-- Note: This constraint ensures that at most one session per user can have is_active = TRUE
-- Multiple sessions with is_active = FALSE are allowed
