// ============================================================================
// ARIS Academy — Reusable OpenAPI JSON Schema definitions
// Used by @fastify/swagger to generate spec from route schemas.
// ============================================================================

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const UuidParam = {
  type: 'object' as const,
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
};

export const UuidParamNamed = (name: string) => ({
  type: 'object' as const,
  properties: { [name]: { type: 'string', format: 'uuid' } },
  required: [name],
});

export const PaginationQuery = {
  type: 'object' as const,
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
};

export const MultiLangText = {
  type: 'object' as const,
  properties: {
    fr: { type: 'string' },
    en: { type: 'string' },
    ar: { type: 'string' },
    pt: { type: 'string' },
  },
  description: 'At least one language required',
};

// ---------------------------------------------------------------------------
// Common response wrappers
// ---------------------------------------------------------------------------

export const SuccessResponse = (dataSchema: object) => ({
  200: {
    description: 'Successful response',
    type: 'object' as const,
    properties: {
      success: { type: 'boolean', const: true },
      data: dataSchema,
    },
  },
});

export const CreatedResponse = (dataSchema: object) => ({
  201: {
    description: 'Resource created',
    type: 'object' as const,
    properties: {
      success: { type: 'boolean', const: true },
      data: dataSchema,
    },
  },
});

export const PaginatedResponse = (dataSchema: object) => ({
  200: {
    description: 'Paginated response',
    type: 'object' as const,
    properties: {
      success: { type: 'boolean', const: true },
      data: { type: 'array', items: dataSchema },
      meta: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
});

export const NoContentResponse = {
  204: { description: 'No content', type: 'null' as const },
};

export const NotFoundResponse = {
  404: {
    description: 'Resource not found',
    type: 'object' as const,
    properties: {
      success: { type: 'boolean', const: false },
      error: { type: 'string' },
    },
  },
};

export const ValidationErrorResponse = {
  400: {
    description: 'Validation error',
    type: 'object' as const,
    properties: {
      success: { type: 'boolean', const: false },
      error: { type: 'string' },
      validation: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  },
};

export const UnauthorizedResponse = {
  401: {
    description: 'Unauthorized — JWT required',
    type: 'object' as const,
    properties: {
      success: { type: 'boolean', const: false },
      error: { type: 'string' },
    },
  },
};

// ---------------------------------------------------------------------------
// Domain objects — Course service
// ---------------------------------------------------------------------------

export const CourseObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    tenant_id: { type: 'string', format: 'uuid' },
    tenant_level: { type: 'string', enum: ['continental', 'rec', 'country'] },
    title: MultiLangText,
    description: MultiLangText,
    slug: { type: 'string' },
    level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    status: { type: 'string', enum: ['draft', 'published', 'archived'] },
    estimated_hours: { type: 'number', nullable: true },
    passing_score: { type: 'integer' },
    tags: { type: 'array', items: { type: 'string' } },
    thumbnail_url: { type: 'string', nullable: true },
    created_by: { type: 'string', format: 'uuid' },
    published_at: { type: 'string', format: 'date-time', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    enrollment_count: { type: 'integer' },
    module_count: { type: 'integer' },
  },
};

export const ModuleObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    course_id: { type: 'string', format: 'uuid' },
    title: MultiLangText,
    description: MultiLangText,
    sort_order: { type: 'integer' },
    estimated_minutes: { type: 'integer', nullable: true },
    is_required: { type: 'boolean' },
    lessons: { type: 'array', items: { $ref: '#/components/schemas/LessonSummary' }, nullable: true },
  },
};

export const LessonObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    module_id: { type: 'string', format: 'uuid' },
    title: MultiLangText,
    type: { type: 'string', enum: ['video', 'text', 'quiz', 'practical', 'replay'] },
    content: { type: 'object', nullable: true },
    video_url: { type: 'string', nullable: true },
    duration_minutes: { type: 'integer', nullable: true },
    sort_order: { type: 'integer' },
    is_required: { type: 'boolean' },
  },
};

// ---------------------------------------------------------------------------
// Domain objects — Learning service
// ---------------------------------------------------------------------------

export const UserObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    tenant_id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    role: { type: 'string', enum: ['learner', 'trainer', 'admin_country', 'admin_rec', 'admin_continental'] },
    preferred_language: { type: 'string', enum: ['en', 'fr', 'ar', 'pt'] },
    avatar_url: { type: 'string', nullable: true },
    is_active: { type: 'boolean' },
  },
};

export const EnrollmentObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    user_id: { type: 'string', format: 'uuid' },
    course_id: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: ['enrolled', 'in_progress', 'completed', 'dropped'] },
    enrolled_at: { type: 'string', format: 'date-time' },
    completed_at: { type: 'string', format: 'date-time', nullable: true },
    progress_pct: { type: 'number' },
  },
};

export const ProgressObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    enrollment_id: { type: 'string', format: 'uuid' },
    lesson_id: { type: 'string', format: 'uuid' },
    time_spent_seconds: { type: 'integer' },
    last_position_seconds: { type: 'integer' },
    is_completed: { type: 'boolean' },
    score: { type: 'number', nullable: true },
  },
};

export const NotificationObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    user_id: { type: 'string', format: 'uuid' },
    type: { type: 'string' },
    title: { type: 'string' },
    body: { type: 'string' },
    is_read: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export const ForumPostObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    author_id: { type: 'string', format: 'uuid' },
    title: MultiLangText,
    body: MultiLangText,
    category: { type: 'string' },
    parent_id: { type: 'string', format: 'uuid', nullable: true },
    upvote_count: { type: 'integer' },
    reply_count: { type: 'integer' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export const StudyGroupObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: MultiLangText,
    description: MultiLangText,
    max_members: { type: 'integer' },
    member_count: { type: 'integer' },
    is_public: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
    created_at: { type: 'string', format: 'date-time' },
  },
};

// ---------------------------------------------------------------------------
// Domain objects — Assessment service
// ---------------------------------------------------------------------------

export const AssessmentObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    course_id: { type: 'string', format: 'uuid' },
    title: MultiLangText,
    type: { type: 'string', enum: ['qcm', 'practical', 'mixed', 'oral'] },
    level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    passing_score: { type: 'integer' },
    time_limit_minutes: { type: 'integer', nullable: true },
    max_attempts: { type: 'integer' },
    shuffle_questions: { type: 'boolean' },
    question_count: { type: 'integer', nullable: true },
    is_final: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export const AttemptObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    assessment_id: { type: 'string', format: 'uuid' },
    user_id: { type: 'string', format: 'uuid' },
    score: { type: 'number', nullable: true },
    passed: { type: 'boolean', nullable: true },
    started_at: { type: 'string', format: 'date-time' },
    completed_at: { type: 'string', format: 'date-time', nullable: true },
    questions: { type: 'array', items: { type: 'object' } },
  },
};

export const CertificationObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    user_id: { type: 'string', format: 'uuid' },
    course_id: { type: 'string', format: 'uuid' },
    cert_number: { type: 'string' },
    level: { type: 'string' },
    score: { type: 'number' },
    issued_at: { type: 'string', format: 'date-time' },
    revoked_at: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const QuestionObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    assessment_id: { type: 'string', format: 'uuid' },
    question_text: { type: 'object' },
    question_type: { type: 'string' },
    options: { type: 'array', items: { type: 'object' }, nullable: true },
    difficulty: { type: 'integer', minimum: 1, maximum: 5 },
    points: { type: 'integer' },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

// ---------------------------------------------------------------------------
// Domain objects — Live service
// ---------------------------------------------------------------------------

export const LiveSessionObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    course_id: { type: 'string', format: 'uuid', nullable: true },
    title: MultiLangText,
    description: MultiLangText,
    scheduled_at: { type: 'string', format: 'date-time' },
    duration_minutes: { type: 'integer' },
    status: { type: 'string', enum: ['planned', 'live', 'ended', 'cancelled'] },
    bbb_meeting_id: { type: 'string', nullable: true },
    trainer_id: { type: 'string', format: 'uuid' },
    max_participants: { type: 'integer' },
    attendee_count: { type: 'integer' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export const RecordingObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    session_id: { type: 'string', format: 'uuid' },
    bbb_record_id: { type: 'string' },
    duration_seconds: { type: 'integer', nullable: true },
    size_bytes: { type: 'integer', nullable: true },
    minio_key: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['pending', 'processing', 'ready', 'failed'] },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export const AttendanceObject = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    session_id: { type: 'string', format: 'uuid' },
    user_id: { type: 'string', format: 'uuid' },
    joined_at: { type: 'string', format: 'date-time' },
    left_at: { type: 'string', format: 'date-time', nullable: true },
    duration_seconds: { type: 'integer', nullable: true },
  },
};

// ---------------------------------------------------------------------------
// Security schema for authenticated routes
// ---------------------------------------------------------------------------

export const BearerSecurity = [{ bearerAuth: [] }];
