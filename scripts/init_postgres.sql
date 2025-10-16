-- ============================================================
-- PostgreSQL Database Initialization Script
-- Product AI Assistant Platform
--
-- This script creates all database tables with proper constraints
-- Run this before the first deployment to staging/production
--
-- IMPORTANT: This script uses TIMESTAMP WITH TIME ZONE for all
-- datetime fields to ensure proper timezone handling across
-- different server locations and client browsers.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users
-- Core user authentication and account management
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,

    -- OTP/HOTP Authentication fields
    hotp_counter INTEGER DEFAULT 0 NOT NULL,
    hotp_secret VARCHAR(255),
    otp_requested_at TIMESTAMP WITH TIME ZONE,
    otp_locked_until TIMESTAMP WITH TIME ZONE,
    otp_failed_attempts INTEGER DEFAULT 0 NOT NULL,
    otp_purpose VARCHAR(50),  -- 'registration' or 'password_reset'

    -- Timestamps (using TIMESTAMP WITH TIME ZONE for proper timezone handling)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================
-- TABLE: user_profiles
-- Extended user profile information for all AI agents
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Career Agent fields - Basic Information
    current_job VARCHAR(255),
    company VARCHAR(255),
    industry VARCHAR(255),
    experience VARCHAR(255),
    work_style VARCHAR(255),
    leadership_experience VARCHAR(255),

    -- Career Agent fields - Skills & Competencies
    skills JSONB,  -- Technical skills
    soft_skills JSONB,
    certifications JSONB,
    skill_gaps JSONB,

    -- Career Agent fields - Goals & Aspirations
    short_term_goals TEXT,
    career_goals TEXT,  -- Long-term career vision
    career_path_preference VARCHAR(255),
    target_industries JSONB,

    -- Career Agent fields - Work Preferences & Values
    work_life_balance_priority VARCHAR(255),
    company_size_preference VARCHAR(255),
    career_risk_tolerance VARCHAR(255),
    geographic_flexibility VARCHAR(255),
    work_values JSONB,

    -- Career Agent fields - Challenges & Development
    career_challenges TEXT,
    professional_strengths JSONB,
    growth_areas JSONB,
    learning_preferences JSONB,

    -- Money Agent fields
    income_range VARCHAR(255),
    financial_goals TEXT,
    investment_experience VARCHAR(255),
    risk_tolerance VARCHAR(255),

    -- Body Agent fields
    fitness_level VARCHAR(255),
    health_goals TEXT,
    dietary_preferences VARCHAR(255),
    exercise_preferences JSONB,

    -- Travel Agent fields
    travel_style VARCHAR(255),
    preferred_destinations JSONB,
    travel_budget VARCHAR(255),
    travel_frequency VARCHAR(255),

    -- Mind Agent fields
    learning_style VARCHAR(255),
    personality_type VARCHAR(255),
    strengths JSONB,
    areas_for_improvement JSONB,

    -- Family Life Agent fields
    family_status VARCHAR(255),
    relationship_goals TEXT,
    work_life_balance VARCHAR(255),

    -- Hobby Agent fields
    hobbies JSONB,
    interests JSONB,
    creative_pursuits JSONB,

    -- Knowledge Agent fields
    education_level VARCHAR(255),
    learning_goals JSONB,
    preferred_learning_methods JSONB,

    -- Spiritual Agent fields
    spiritual_practices JSONB,
    mindfulness_level VARCHAR(255),
    stress_management JSONB,

    -- Avatar field
    avatar_url VARCHAR(500),

    -- Timestamps (using TIMESTAMP WITH TIME ZONE for proper timezone handling)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================================
-- TABLE: resumes
-- User resume uploads and metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,  -- UUID-based filename
    original_filename VARCHAR(255) NOT NULL,  -- Original uploaded filename
    file_path VARCHAR(500) NOT NULL,  -- Full path to the resume file
    file_type VARCHAR(50) NOT NULL,  -- File extension (pdf or txt)
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Timestamps (using TIMESTAMP WITH TIME ZONE for proper timezone handling)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_filename ON resumes(filename);

-- ============================================================
-- TABLE: career_insights
-- Career insights generated from resume analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS career_insights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,

    -- JSON data fields
    professional_data TEXT,  -- JSON string of professional data
    dashboard_summaries TEXT,  -- JSON string of LLM-generated summaries for Dashboard
    summaries_generated_at TIMESTAMP WITH TIME ZONE,  -- When summaries were last generated

    -- Timestamps (using TIMESTAMP WITH TIME ZONE for proper timezone handling)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_career_insights_user_id ON career_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_career_insights_resume_id ON career_insights(resume_id);

-- ============================================================
-- TABLE: chat_sessions
-- Chat session management
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255) NOT NULL,
    first_message_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE NOT NULL,
    unread BOOLEAN DEFAULT FALSE NOT NULL,

    -- Timestamps (using TIMESTAMP WITH TIME ZONE for proper timezone handling)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_active ON chat_sessions(is_active);

-- ============================================================
-- TABLE: chat_messages
-- Individual chat messages
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    sender VARCHAR(50) NOT NULL,  -- 'user' or 'assistant'
    agent_type VARCHAR(50) DEFAULT 'dashboard',  -- 'dashboard', 'career', etc.

    -- Timestamps (using TIMESTAMP WITH TIME ZONE for proper timezone handling)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_type ON chat_messages(agent_type);

-- ============================================================
-- TABLE: user_activities
-- Track all user activities across the platform
-- ============================================================
CREATE TABLE IF NOT EXISTS user_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Activity details
    activity_type VARCHAR(50) NOT NULL,  -- 'chat', 'resume_analysis', 'agent_interaction'
    activity_source VARCHAR(50) NOT NULL,  -- 'dashboard', 'career', 'money', 'mind', etc.
    activity_title VARCHAR(255) NOT NULL,  -- Human readable title
    activity_description TEXT,  -- Optional detailed description

    -- Context data (JSON field for flexible storage)
    activity_metadata JSONB,  -- Store additional context like agent type, session info, etc.

    -- References to related entities
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE SET NULL,
    message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,

    -- Timestamps (using TIMESTAMP WITH TIME ZONE for proper timezone handling)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_source ON user_activities(activity_source);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);

-- ============================================================
-- TABLE: daily_recommendations
-- AI-generated daily recommendations for users
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE NOT NULL,  -- Date for which recommendations are generated
    recommendations JSONB NOT NULL,  -- Array of 3 recommendation objects

    -- Context data used for generation
    context_data JSONB,  -- Profile and resume analysis data used
    generation_status VARCHAR(50) DEFAULT 'generated' NOT NULL,  -- generated, error, pending

    -- Timestamps (using TIMESTAMP WITH TIME ZONE for proper timezone handling)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_recommendations_user_id ON daily_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_recommendations_date ON daily_recommendations(date);
CREATE INDEX IF NOT EXISTS idx_daily_recommendations_user_date ON daily_recommendations(user_id, date DESC);

-- ============================================================
-- TRIGGERS: Auto-update updated_at timestamps
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_resumes_updated_at ON resumes;
CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_career_insights_updated_at ON career_insights;
CREATE TRIGGER update_career_insights_updated_at BEFORE UPDATE ON career_insights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_activities_updated_at ON user_activities;
CREATE TRIGGER update_user_activities_updated_at BEFORE UPDATE ON user_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_recommendations_updated_at ON daily_recommendations;
CREATE TRIGGER update_daily_recommendations_updated_at BEFORE UPDATE ON daily_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SUMMARY
-- ============================================================
-- Tables created:
-- 1. users (authentication core with OTP support)
-- 2. user_profiles (extended user info for all agents)
-- 3. resumes (file uploads and metadata)
-- 4. career_insights (resume analysis results)
-- 5. chat_sessions (conversation sessions)
-- 6. chat_messages (individual messages)
-- 7. user_activities (activity tracking)
-- 8. daily_recommendations (AI daily insights)
--
-- Total: 8 tables with:
--   - TIMESTAMP WITH TIME ZONE for all datetime fields (proper timezone handling)
--   - Indexes for optimal query performance
--   - Foreign keys with CASCADE constraints
--   - Auto-update triggers for updated_at columns
--   - JSONB fields for flexible data storage
-- ============================================================
