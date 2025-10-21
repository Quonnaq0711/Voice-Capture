-- ============================================================
-- Database Migration Script for Staging Environment
-- Date: 2025-10-21
-- Description: Create refresh_tokens table and add indexes to all tables
-- ============================================================

-- Connect to idii-staging database
\c "idii-staging"

-- ============================================================
-- 1. Create refresh_tokens table
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    user_agent VARCHAR,
    ip_address VARCHAR
);

COMMENT ON TABLE refresh_tokens IS 'Stores JWT refresh tokens for user authentication';
COMMENT ON COLUMN refresh_tokens.token IS 'Unique refresh token string';
COMMENT ON COLUMN refresh_tokens.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN refresh_tokens.revoked IS 'Whether the token has been revoked';

-- ============================================================
-- 2. Add indexes to chat_messages table
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- ============================================================
-- 3. Add indexes to chat_sessions table
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_active ON chat_sessions(is_active);

-- ============================================================
-- 4. Add indexes to resumes table
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at);

-- ============================================================
-- 5. Add indexes to user_activities table
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_activity_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_activity_source ON user_activities(activity_source);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at);

-- ============================================================
-- 6. Add indexes to career_insights table
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_career_insights_user_id ON career_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_career_insights_resume_id ON career_insights(resume_id);
CREATE INDEX IF NOT EXISTS idx_career_insights_created_at ON career_insights(created_at);

-- ============================================================
-- 7. Add indexes to refresh_tokens table
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked);

-- ============================================================
-- 8. Verify indexes were created
-- ============================================================
\echo '============================================================'
\echo 'Listing all indexes in the database:'
\echo '============================================================'

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================
-- 9. Verify refresh_tokens table structure
-- ============================================================
\echo ''
\echo '============================================================'
\echo 'Refresh Tokens Table Structure:'
\echo '============================================================'

\d refresh_tokens

\echo ''
\echo '✅ Migration completed successfully!'
\echo ''
