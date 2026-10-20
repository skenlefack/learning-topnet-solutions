// ============================================================================
// Test Helper — Pure Mock Data Factories (no DB required)
// Returns plain objects for unit tests with vi.mock()
// ============================================================================

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 'usr_test_001',
    email: 'test@example.org',
    first_name: 'Test',
    last_name: 'User',
    role: 'learner',
    tenant_id: 'kenya',
    tenant_level: 'country',
    preferred_language: 'en',
    is_active: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

export function createMockCourse(overrides: Record<string, any> = {}) {
  return {
    id: 'crs_test_001',
    title: { en: 'Test Course', fr: 'Cours Test' },
    description: { en: 'A test course', fr: 'Un cours test' },
    slug: 'test-course',
    level: 'beginner',
    status: 'published',
    estimated_hours: 10,
    passing_score: 70,
    tags: ['test'],
    tenant_id: 'topnet-solutions',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export function createMockAssessment(overrides: Record<string, any> = {}) {
  return {
    id: 'asm_test_001',
    course_id: 'crs_test_001',
    title: { en: 'Final Assessment', fr: 'Evaluation finale' },
    passing_score: 70,
    max_attempts: 3,
    time_limit_minutes: 60,
    question_count: 10,
    is_adaptive: false,
    is_final: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export function createMockQuestion(overrides: Record<string, any> = {}) {
  return {
    id: 'q_test_001',
    assessment_id: 'asm_test_001',
    question_text: { en: 'What is 2+2?', fr: 'Combien font 2+2?' },
    question_type: 'single_choice',
    options: [
      { id: 'a', text: { en: '3' }, is_correct: false },
      { id: 'b', text: { en: '4' }, is_correct: true },
      { id: 'c', text: { en: '5' }, is_correct: false },
    ],
    correct_answer: null,
    difficulty: 1,
    points: 1,
    tags: ['math'],
    explanation: { en: 'Two plus two equals four.' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Assessment Attempt
// ---------------------------------------------------------------------------

export function createMockAttempt(overrides: Record<string, any> = {}) {
  return {
    id: 'att_test_001',
    user_id: 'usr_test_001',
    assessment_id: 'asm_test_001',
    started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    submitted_at: null,
    answers: {},
    score: null,
    passed: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Live Session
// ---------------------------------------------------------------------------

export function createMockLiveSession(overrides: Record<string, any> = {}) {
  return {
    id: 'live_test_001',
    course_id: 'crs_test_001',
    title: { en: 'Live Training Session', fr: 'Session de formation en direct' },
    description: { en: 'A test live session' },
    trainer_id: 'usr_trainer_001',
    tenant_id: 'topnet-solutions',
    status: 'scheduled',
    bbb_meeting_id: 'bbb-meeting-001',
    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 90,
    max_participants: 100,
    recording_url: null,
    attendee_count: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export function createMockEnrollment(overrides: Record<string, any> = {}) {
  return {
    id: 'enr_test_001',
    user_id: 'usr_test_001',
    course_id: 'crs_test_001',
    status: 'active',
    progress_percent: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------------

export function createMockTenant(overrides: Record<string, any> = {}) {
  return {
    id: 'tenant_test_001',
    name: 'Test Tenant',
    code: 'TST',
    level: 'country',
    parent_id: null,
    ...overrides,
  };
}
