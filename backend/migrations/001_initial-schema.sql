-- ============================================================================
-- Migration 001: Initial Schema (baseline)
-- This is a copy of infra/postgres/init.sql — existing deployments should
-- mark this migration as already applied with: npx node-pg-migrate up --fake
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema
CREATE SCHEMA IF NOT EXISTS academy_core;
SET search_path TO academy_core, public;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE tenant_level AS ENUM ('continental', 'rec', 'country');
CREATE TYPE course_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE lesson_type AS ENUM ('video', 'text', 'quiz', 'practical', 'replay');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'paused', 'expired');
CREATE TYPE assessment_type AS ENUM ('qcm', 'practical', 'mixed', 'oral');
CREATE TYPE certification_status AS ENUM ('pending', 'issued', 'revoked', 'expired');
CREATE TYPE live_session_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
CREATE TYPE user_role AS ENUM ('learner', 'trainer', 'admin_country', 'admin_rec', 'admin_continental');
CREATE TYPE supported_language AS ENUM ('en', 'fr', 'ar', 'pt');

-- ============================================================================
-- TENANTS
-- ============================================================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE,
    level tenant_level NOT NULL,
    parent_id UUID REFERENCES tenants(id),
    logo_url TEXT,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_level ON tenants(level);
CREATE INDEX idx_tenants_parent ON tenants(parent_id);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aris_user_id UUID UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'learner',
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    preferred_language supported_language DEFAULT 'fr',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- COURSES
-- ============================================================================

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    tenant_level tenant_level NOT NULL DEFAULT 'continental',
    title JSONB NOT NULL,
    description JSONB,
    slug VARCHAR(255) NOT NULL,
    level course_level NOT NULL,
    status course_status NOT NULL DEFAULT 'draft',
    thumbnail_url TEXT,
    estimated_hours DECIMAL(5,1),
    passing_score INTEGER DEFAULT 70,
    prerequisites UUID[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_courses_slug ON courses(slug);
CREATE INDEX idx_courses_tenant ON courses(tenant_id);
CREATE INDEX idx_courses_level ON courses(level);
CREATE INDEX idx_courses_status ON courses(status);

-- ============================================================================
-- COURSE OVERRIDES
-- ============================================================================

CREATE TABLE course_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    tenant_level tenant_level NOT NULL,
    override_data JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, tenant_id)
);

CREATE INDEX idx_overrides_course ON course_overrides(course_id);
CREATE INDEX idx_overrides_tenant ON course_overrides(tenant_id);

-- ============================================================================
-- MODULES
-- ============================================================================

CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title JSONB NOT NULL,
    description JSONB,
    sort_order INTEGER NOT NULL DEFAULT 0,
    estimated_minutes INTEGER,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modules_course ON modules(course_id);

-- ============================================================================
-- LESSONS
-- ============================================================================

CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title JSONB NOT NULL,
    type lesson_type NOT NULL,
    content JSONB,
    video_url TEXT,
    duration_minutes INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lessons_module ON lessons(module_id);

-- ============================================================================
-- ENROLLMENTS
-- ============================================================================

CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    status enrollment_status NOT NULL DEFAULT 'active',
    progress_percent DECIMAL(5,2) DEFAULT 0,
    current_level course_level,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);

-- ============================================================================
-- PROGRESS TRACKING
-- ============================================================================

CREATE TABLE progress_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    lesson_id UUID NOT NULL REFERENCES lessons(id),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id),
    is_completed BOOLEAN DEFAULT false,
    score DECIMAL(5,2),
    time_spent_seconds INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    last_position_seconds INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_progress_user ON progress_tracking(user_id);
CREATE INDEX idx_progress_enrollment ON progress_tracking(enrollment_id);

-- ============================================================================
-- ASSESSMENTS
-- ============================================================================

CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id),
    title JSONB NOT NULL,
    type assessment_type NOT NULL DEFAULT 'qcm',
    level course_level NOT NULL,
    passing_score INTEGER NOT NULL DEFAULT 70,
    time_limit_minutes INTEGER,
    max_attempts INTEGER DEFAULT 3,
    shuffle_questions BOOLEAN DEFAULT true,
    question_count INTEGER,
    is_final BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_course ON assessments(course_id);

-- ============================================================================
-- QUESTION BANK
-- ============================================================================

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    question_text JSONB NOT NULL,
    question_type VARCHAR(20) NOT NULL DEFAULT 'single_choice',
    options JSONB,
    correct_answer JSONB,
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    points INTEGER DEFAULT 1,
    tags TEXT[] DEFAULT '{}',
    explanation JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_assessment ON questions(assessment_id);
CREATE INDEX idx_questions_tags ON questions USING GIN(tags);

-- ============================================================================
-- ASSESSMENT ATTEMPTS
-- ============================================================================

CREATE TABLE assessment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id),
    score DECIMAL(5,2),
    answers JSONB,
    passed BOOLEAN,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    time_taken_seconds INTEGER
);

CREATE INDEX idx_attempts_user ON assessment_attempts(user_id);
CREATE INDEX idx_attempts_assessment ON assessment_attempts(assessment_id);

-- ============================================================================
-- CERTIFICATIONS
-- ============================================================================

CREATE TABLE certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    level course_level NOT NULL,
    status certification_status NOT NULL DEFAULT 'pending',
    certificate_number VARCHAR(50) UNIQUE NOT NULL,
    qr_code_data TEXT,
    pdf_url TEXT,
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_certs_user ON certifications(user_id);
CREATE INDEX idx_certs_number ON certifications(certificate_number);

-- ============================================================================
-- LIVE SESSIONS (BigBlueButton)
-- ============================================================================

CREATE TABLE live_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id),
    title JSONB NOT NULL,
    description JSONB,
    trainer_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    status live_session_status NOT NULL DEFAULT 'scheduled',
    bbb_meeting_id VARCHAR(255),
    bbb_internal_meeting_id VARCHAR(255),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    max_participants INTEGER DEFAULT 300,
    recording_url TEXT,
    recording_duration_seconds INTEGER,
    attendee_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_course ON live_sessions(course_id);
CREATE INDEX idx_live_trainer ON live_sessions(trainer_id);
CREATE INDEX idx_live_tenant ON live_sessions(tenant_id);
CREATE INDEX idx_live_status ON live_sessions(status);
CREATE INDEX idx_live_scheduled ON live_sessions(scheduled_at);

-- ============================================================================
-- LIVE SESSION ATTENDANCE
-- ============================================================================

CREATE TABLE live_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES live_sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    UNIQUE(session_id, user_id)
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    type VARCHAR(50) NOT NULL,
    title JSONB NOT NULL,
    body JSONB,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- FORUM POSTS (Community)
-- ============================================================================

CREATE TABLE forum_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    author_id UUID NOT NULL REFERENCES users(id),
    parent_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    title JSONB,
    body JSONB NOT NULL,
    upvotes INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forum_posts_tenant ON forum_posts(tenant_id);
CREATE INDEX idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX idx_forum_posts_parent ON forum_posts(parent_id);
CREATE INDEX idx_forum_posts_category ON forum_posts(category);

-- ============================================================================
-- STUDY GROUPS (Community)
-- ============================================================================

CREATE TABLE study_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name JSONB NOT NULL,
    description JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    max_members INTEGER DEFAULT 20,
    member_count INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT true,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_groups_tenant ON study_groups(tenant_id);

CREATE TABLE study_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_sgm_group ON study_group_members(group_id);
CREATE INDEX idx_sgm_user ON study_group_members(user_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'academy_core' AND column_name = 'updated_at'
        GROUP BY table_name
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON academy_core.%I
             FOR EACH ROW EXECUTE FUNCTION academy_core.update_updated_at()',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION academy_core.current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION academy_core.current_user_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION academy_core.is_tenant_visible(target_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
    _ct    UUID := academy_core.current_tenant_id();
    _level TEXT := current_setting('app.current_tenant_level', true);
BEGIN
    IF _ct IS NULL OR COALESCE(_level, '') = '' THEN
        RETURN TRUE;
    END IF;
    IF _level = 'continental' THEN
        RETURN TRUE;
    END IF;
    IF target_tenant_id = _ct THEN
        RETURN TRUE;
    END IF;
    IF _level = 'rec' THEN
        RETURN EXISTS (
            SELECT 1 FROM academy_core.tenants
            WHERE id = target_tenant_id AND parent_id = _ct
        );
    END IF;
    RETURN FALSE;
END;
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- courses
CREATE POLICY courses_select ON academy_core.courses FOR SELECT USING (academy_core.is_tenant_visible(tenant_id) OR tenant_level = 'continental');
CREATE POLICY courses_insert ON academy_core.courses FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY courses_update ON academy_core.courses FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND academy_core.is_tenant_visible(tenant_id)) OR (current_setting('app.current_user_role', true) = 'trainer' AND created_by = academy_core.current_user_id()));
CREATE POLICY courses_delete ON academy_core.courses FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND academy_core.is_tenant_visible(tenant_id)));

-- users
CREATE POLICY users_select ON academy_core.users FOR SELECT USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY users_insert ON academy_core.users FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY users_update ON academy_core.users FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND academy_core.is_tenant_visible(tenant_id)) OR id = academy_core.current_user_id());
CREATE POLICY users_delete ON academy_core.users FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND academy_core.is_tenant_visible(tenant_id)));

-- enrollments
CREATE POLICY enrollments_select ON academy_core.enrollments FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR current_setting('app.current_tenant_level', true) = 'continental' OR EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = enrollments.user_id AND academy_core.is_tenant_visible(u.tenant_id)));
CREATE POLICY enrollments_insert ON academy_core.enrollments FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR user_id = academy_core.current_user_id() OR EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = user_id AND u.tenant_id = academy_core.current_tenant_id()));
CREATE POLICY enrollments_update ON academy_core.enrollments FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = enrollments.user_id AND academy_core.is_tenant_visible(u.tenant_id))) OR user_id = academy_core.current_user_id());
CREATE POLICY enrollments_delete ON academy_core.enrollments FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = enrollments.user_id AND academy_core.is_tenant_visible(u.tenant_id))));

-- progress_tracking
CREATE POLICY progress_select ON academy_core.progress_tracking FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR current_setting('app.current_tenant_level', true) = 'continental' OR EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = progress_tracking.user_id AND academy_core.is_tenant_visible(u.tenant_id)));
CREATE POLICY progress_insert ON academy_core.progress_tracking FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR user_id = academy_core.current_user_id() OR EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = user_id AND u.tenant_id = academy_core.current_tenant_id()));
CREATE POLICY progress_update ON academy_core.progress_tracking FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = progress_tracking.user_id AND academy_core.is_tenant_visible(u.tenant_id))) OR user_id = academy_core.current_user_id());
CREATE POLICY progress_delete ON academy_core.progress_tracking FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = progress_tracking.user_id AND academy_core.is_tenant_visible(u.tenant_id))));

-- certifications
CREATE POLICY certifications_select ON academy_core.certifications FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR current_setting('app.current_tenant_level', true) = 'continental' OR EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = certifications.user_id AND academy_core.is_tenant_visible(u.tenant_id)));
CREATE POLICY certifications_insert ON academy_core.certifications FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = user_id AND academy_core.is_tenant_visible(u.tenant_id)));
CREATE POLICY certifications_update ON academy_core.certifications FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = certifications.user_id AND academy_core.is_tenant_visible(u.tenant_id))) OR user_id = academy_core.current_user_id());
CREATE POLICY certifications_delete ON academy_core.certifications FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = certifications.user_id AND academy_core.is_tenant_visible(u.tenant_id))));

-- live_sessions
CREATE POLICY live_sessions_select ON academy_core.live_sessions FOR SELECT USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY live_sessions_insert ON academy_core.live_sessions FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY live_sessions_update ON academy_core.live_sessions FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND academy_core.is_tenant_visible(tenant_id)) OR (current_setting('app.current_user_role', true) = 'trainer' AND trainer_id = academy_core.current_user_id()));
CREATE POLICY live_sessions_delete ON academy_core.live_sessions FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND academy_core.is_tenant_visible(tenant_id)));

-- modules
CREATE POLICY modules_select ON academy_core.modules FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR current_setting('app.current_tenant_level', true) = 'continental' OR EXISTS (SELECT 1 FROM academy_core.courses c WHERE c.id = modules.course_id AND (academy_core.is_tenant_visible(c.tenant_id) OR c.tenant_level = 'continental')));
CREATE POLICY modules_insert ON academy_core.modules FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR EXISTS (SELECT 1 FROM academy_core.courses c WHERE c.id = course_id AND c.tenant_id = academy_core.current_tenant_id()));
CREATE POLICY modules_update ON academy_core.modules FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.courses c WHERE c.id = modules.course_id AND academy_core.is_tenant_visible(c.tenant_id))));
CREATE POLICY modules_delete ON academy_core.modules FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.courses c WHERE c.id = modules.course_id AND academy_core.is_tenant_visible(c.tenant_id))));

-- lessons
CREATE POLICY lessons_select ON academy_core.lessons FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR current_setting('app.current_tenant_level', true) = 'continental' OR EXISTS (SELECT 1 FROM academy_core.modules m JOIN academy_core.courses c ON c.id = m.course_id WHERE m.id = lessons.module_id AND (academy_core.is_tenant_visible(c.tenant_id) OR c.tenant_level = 'continental')));
CREATE POLICY lessons_insert ON academy_core.lessons FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR EXISTS (SELECT 1 FROM academy_core.modules m JOIN academy_core.courses c ON c.id = m.course_id WHERE m.id = module_id AND c.tenant_id = academy_core.current_tenant_id()));
CREATE POLICY lessons_update ON academy_core.lessons FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.modules m JOIN academy_core.courses c ON c.id = m.course_id WHERE m.id = lessons.module_id AND academy_core.is_tenant_visible(c.tenant_id))));
CREATE POLICY lessons_delete ON academy_core.lessons FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.modules m JOIN academy_core.courses c ON c.id = m.course_id WHERE m.id = lessons.module_id AND academy_core.is_tenant_visible(c.tenant_id))));

-- questions
CREATE POLICY questions_select ON academy_core.questions FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR current_setting('app.current_tenant_level', true) = 'continental' OR EXISTS (SELECT 1 FROM academy_core.assessments a JOIN academy_core.courses c ON c.id = a.course_id WHERE a.id = questions.assessment_id AND (academy_core.is_tenant_visible(c.tenant_id) OR c.tenant_level = 'continental')));
CREATE POLICY questions_insert ON academy_core.questions FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR EXISTS (SELECT 1 FROM academy_core.assessments a JOIN academy_core.courses c ON c.id = a.course_id WHERE a.id = assessment_id AND c.tenant_id = academy_core.current_tenant_id()));
CREATE POLICY questions_update ON academy_core.questions FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.assessments a JOIN academy_core.courses c ON c.id = a.course_id WHERE a.id = questions.assessment_id AND academy_core.is_tenant_visible(c.tenant_id))));
CREATE POLICY questions_delete ON academy_core.questions FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.assessments a JOIN academy_core.courses c ON c.id = a.course_id WHERE a.id = questions.assessment_id AND academy_core.is_tenant_visible(c.tenant_id))));

-- assessment_attempts
CREATE POLICY attempts_select ON academy_core.assessment_attempts FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR current_setting('app.current_tenant_level', true) = 'continental' OR EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = assessment_attempts.user_id AND academy_core.is_tenant_visible(u.tenant_id)));
CREATE POLICY attempts_insert ON academy_core.assessment_attempts FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR user_id = academy_core.current_user_id());
CREATE POLICY attempts_update ON academy_core.assessment_attempts FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = assessment_attempts.user_id AND academy_core.is_tenant_visible(u.tenant_id))) OR user_id = academy_core.current_user_id());
CREATE POLICY attempts_delete ON academy_core.assessment_attempts FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country') AND EXISTS (SELECT 1 FROM academy_core.users u WHERE u.id = assessment_attempts.user_id AND academy_core.is_tenant_visible(u.tenant_id))));

-- notifications
CREATE POLICY notifications_select ON academy_core.notifications FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR user_id = academy_core.current_user_id());
CREATE POLICY notifications_insert ON academy_core.notifications FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR academy_core.is_tenant_visible(tenant_id));
CREATE POLICY notifications_update ON academy_core.notifications FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR user_id = academy_core.current_user_id());
CREATE POLICY notifications_delete ON academy_core.notifications FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR user_id = academy_core.current_user_id());

-- forum_posts
CREATE POLICY forum_posts_select ON academy_core.forum_posts FOR SELECT USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY forum_posts_insert ON academy_core.forum_posts FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY forum_posts_update ON academy_core.forum_posts FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR author_id = academy_core.current_user_id() OR current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country'));
CREATE POLICY forum_posts_delete ON academy_core.forum_posts FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR author_id = academy_core.current_user_id() OR current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country'));

-- study_groups
CREATE POLICY study_groups_select ON academy_core.study_groups FOR SELECT USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY study_groups_insert ON academy_core.study_groups FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY study_groups_update ON academy_core.study_groups FOR UPDATE USING (academy_core.current_tenant_id() IS NULL OR created_by = academy_core.current_user_id() OR current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country'));
CREATE POLICY study_groups_delete ON academy_core.study_groups FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR created_by = academy_core.current_user_id() OR current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country'));

-- study_group_members
CREATE POLICY sgm_select ON academy_core.study_group_members FOR SELECT USING (academy_core.current_tenant_id() IS NULL OR EXISTS (SELECT 1 FROM academy_core.study_groups g WHERE g.id = study_group_members.group_id AND academy_core.is_tenant_visible(g.tenant_id)));
CREATE POLICY sgm_insert ON academy_core.study_group_members FOR INSERT WITH CHECK (academy_core.current_tenant_id() IS NULL OR user_id = academy_core.current_user_id());
CREATE POLICY sgm_delete ON academy_core.study_group_members FOR DELETE USING (academy_core.current_tenant_id() IS NULL OR user_id = academy_core.current_user_id() OR EXISTS (SELECT 1 FROM academy_core.study_groups g WHERE g.id = study_group_members.group_id AND g.created_by = academy_core.current_user_id()));

-- ============================================================================
-- APPLICATION ROLE
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'academy_app') THEN
        CREATE ROLE academy_app WITH LOGIN NOINHERIT;
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA academy_core TO academy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA academy_core TO academy_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA academy_core TO academy_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA academy_core TO academy_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA academy_core
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO academy_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA academy_core
    GRANT USAGE ON SEQUENCES TO academy_app;
