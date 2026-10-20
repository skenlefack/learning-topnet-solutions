-- ============================================================================
-- Migration 010: Skills Integration
-- Enables standalone assessments (not tied to courses), adds skill tracks,
-- test formats, domain-based scoring, tab-switch detection, skill levels.
-- ============================================================================

SET search_path TO academy_core, public;

-- ============================================================================
-- 1. MAKE ASSESSMENTS STANDALONE-CAPABLE
-- ============================================================================

-- Allow assessments without a course (standalone skill tests)
ALTER TABLE assessments ALTER COLUMN course_id DROP NOT NULL;

-- Add skill track reference and format metadata
ALTER TABLE assessments
  ADD COLUMN skill_track_id UUID,
  ADD COLUMN format VARCHAR(20),
  ADD COLUMN domains JSONB DEFAULT '{}';

-- ============================================================================
-- 2. SKILL TRACKS — standalone test categories (IT domains, certifications)
-- ============================================================================

CREATE TYPE skill_track_kind AS ENUM ('track', 'cert');

CREATE TABLE skill_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(30) NOT NULL,
    kind skill_track_kind NOT NULL DEFAULT 'track',
    name JSONB NOT NULL DEFAULT '{}',
    short_name JSONB DEFAULT '{}',
    description JSONB DEFAULT '{}',
    role_description JSONB DEFAULT '{}',
    -- certification metadata (for kind='cert')
    vendor VARCHAR(100),
    family VARCHAR(100),
    exam_code VARCHAR(30),
    exam_info JSONB DEFAULT '{}',
    exam_duration_sec INTEGER,
    -- domains: { "ITIL": "ITIL 4 & gestion...", "NET": "Réseau..." }
    domains JSONB NOT NULL DEFAULT '{}',
    -- domain weights for readiness scoring (cert only)
    -- { "ITIL": 0.2, "NET": 0.15, ... }
    weights JSONB DEFAULT '{}',
    -- curriculum/program info
    curriculum JSONB DEFAULT '{}',
    -- display
    icon_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_skill_tracks_tenant ON skill_tracks(tenant_id);
CREATE INDEX idx_skill_tracks_kind ON skill_tracks(kind);
CREATE INDEX idx_skill_tracks_active ON skill_tracks(tenant_id, is_active);

-- FK from assessments to skill_tracks
ALTER TABLE assessments
  ADD CONSTRAINT fk_assessments_skill_track
  FOREIGN KEY (skill_track_id) REFERENCES skill_tracks(id);

CREATE INDEX idx_assessments_skill_track ON assessments(skill_track_id)
  WHERE skill_track_id IS NOT NULL;

-- ============================================================================
-- 3. SKILL TEST FORMATS
-- ============================================================================

CREATE TABLE skill_test_formats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(20) NOT NULL,
    label JSONB NOT NULL DEFAULT '{}',
    question_count INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    is_free BOOLEAN NOT NULL DEFAULT false,
    -- 'track' formats: complet, express
    -- 'cert' formats: certif, decouverte
    applicable_to skill_track_kind[] NOT NULL DEFAULT '{track,cert}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_skill_formats_tenant ON skill_test_formats(tenant_id);

-- ============================================================================
-- 4. ENHANCE QUESTIONS — add domain column for stratified selection
-- ============================================================================

ALTER TABLE questions
  ADD COLUMN domain VARCHAR(30),
  ADD COLUMN original_id VARCHAR(30),
  ADD COLUMN skill_track_id UUID REFERENCES skill_tracks(id);

CREATE INDEX idx_questions_domain ON questions(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_questions_skill_track ON questions(skill_track_id)
  WHERE skill_track_id IS NOT NULL;

-- ============================================================================
-- 5. ENHANCE ASSESSMENT ATTEMPTS — standalone support + skills metadata
-- ============================================================================

-- Allow attempts without enrollment (standalone skill tests)
ALTER TABLE assessment_attempts ALTER COLUMN enrollment_id DROP NOT NULL;

-- Add skills-specific fields
ALTER TABLE assessment_attempts
  ADD COLUMN skill_track_id UUID REFERENCES skill_tracks(id),
  ADD COLUMN format VARCHAR(20),
  ADD COLUMN tab_switches INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN time_up BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN skill_level VARCHAR(30),
  ADD COLUMN readiness DECIMAL(5,1),
  ADD COLUMN domain_scores JSONB DEFAULT '{}',
  ADD COLUMN question_order TEXT[] DEFAULT '{}',
  ADD COLUMN via VARCHAR(20),
  ADD COLUMN unlocked BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN cert_code VARCHAR(20) UNIQUE,
  ADD COLUMN token_hash VARCHAR(64);

CREATE INDEX idx_attempts_skill_track ON assessment_attempts(skill_track_id)
  WHERE skill_track_id IS NOT NULL;
CREATE INDEX idx_attempts_cert_code ON assessment_attempts(cert_code)
  WHERE cert_code IS NOT NULL;

-- ============================================================================
-- 6. RLS POLICIES FOR NEW TABLES
-- ============================================================================

ALTER TABLE skill_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_test_formats ENABLE ROW LEVEL SECURITY;

-- skill_tracks
CREATE POLICY st_select ON skill_tracks FOR SELECT
  USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY st_insert ON skill_tracks FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY st_update ON skill_tracks FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));
CREATE POLICY st_delete ON skill_tracks FOR DELETE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));

-- skill_test_formats
CREATE POLICY stf_select ON skill_test_formats FOR SELECT
  USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY stf_insert ON skill_test_formats FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY stf_update ON skill_test_formats FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_skill_tracks_updated_at
  BEFORE UPDATE ON academy_core.skill_tracks
  FOR EACH ROW EXECUTE FUNCTION academy_core.update_updated_at();

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON skill_tracks TO academy_app;
GRANT SELECT, INSERT, UPDATE ON skill_test_formats TO academy_app;
