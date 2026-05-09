-- ============================================================================
-- Migration 008: Path-level assessments and certifications
-- Adds path_id to certifications for path-level certification
-- ============================================================================

SET search_path TO academy_core, public;

-- Add path_id to certifications (for path-level certificates)
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS path_id UUID REFERENCES learning_paths(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_certs_path ON certifications(path_id);

-- Add path_id to assessment_attempts (for path composite exams)
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS path_id UUID REFERENCES learning_paths(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attempts_path ON assessment_attempts(path_id);
