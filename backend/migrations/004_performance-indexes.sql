-- ============================================================================
-- Migration 004: Performance indexes for production workloads
-- Composite indexes targeting the most frequent query patterns
-- ============================================================================

SET search_path TO academy_core, public;

-- Enrollments: dashboard query (user + status filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_user_status
  ON enrollments(user_id, status);

-- Progress tracking: lesson completion check per enrollment
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_progress_enrollment_completed
  ON progress_tracking(enrollment_id, is_completed);

-- Progress tracking: user progress with completion timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_progress_user_completed
  ON progress_tracking(user_id, is_completed) WHERE is_completed = true;

-- Notifications: user inbox (unread first, newest first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread_created
  ON notifications(user_id, is_read, created_at DESC);

-- Forum posts: tenant + category listing (newest first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_posts_tenant_category_created
  ON forum_posts(tenant_id, category, created_at DESC);

-- Forum posts: thread replies lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_posts_parent_created
  ON forum_posts(parent_id, created_at ASC) WHERE parent_id IS NOT NULL;

-- Assessment attempts: user history per assessment
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_user_assessment
  ON assessment_attempts(user_id, assessment_id, started_at DESC);

-- Live sessions: upcoming sessions per tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_tenant_scheduled
  ON live_sessions(tenant_id, status, scheduled_at)
  WHERE status IN ('scheduled', 'live');

-- Certifications: user + status for dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certs_user_status
  ON certifications(user_id, status);

-- Audit log: recent actions per tenant (admin dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_tenant_created
  ON audit_log(tenant_id, created_at DESC);

-- Courses: published courses per tenant (catalog)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courses_tenant_status_published
  ON courses(tenant_id, status, published_at DESC)
  WHERE status = 'published';
