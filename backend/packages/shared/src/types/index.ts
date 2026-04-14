// ============================================================================
// ARIS Academy — Shared Types
// ============================================================================

export type TenantLevel = 'continental' | 'rec' | 'country';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type LessonType = 'video' | 'text' | 'quiz' | 'practical' | 'replay';
export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'expired';
export type AssessmentType = 'qcm' | 'practical' | 'mixed' | 'oral';
export type CertificationStatus = 'pending' | 'issued' | 'revoked' | 'expired';
export type LiveSessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type UserRole = 'learner' | 'trainer' | 'admin_country' | 'admin_rec' | 'admin_continental';
export type SupportedLanguage = 'en' | 'fr' | 'ar' | 'pt';

export interface MultiLangText {
  en?: string;
  fr?: string;
  ar?: string;
  pt?: string;
}

export interface Tenant {
  id: string;
  name: string;
  code: string;
  level: TenantLevel;
  parentId?: string;
  logoUrl?: string;
  config: Record<string, unknown>;
}

export interface User {
  id: string;
  arisUserId?: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  tenantId: string;
  preferredLanguage: SupportedLanguage;
  isActive: boolean;
}

export interface Course {
  id: string;
  tenantId: string;
  tenantLevel: TenantLevel;
  title: MultiLangText;
  description?: MultiLangText;
  slug: string;
  level: CourseLevel;
  status: CourseStatus;
  thumbnailUrl?: string;
  estimatedHours?: number;
  passingScore: number;
  prerequisites: string[];
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: MultiLangText;
  description?: MultiLangText;
  sortOrder: number;
  estimatedMinutes?: number;
  isRequired: boolean;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: MultiLangText;
  type: LessonType;
  content?: Record<string, unknown>;
  videoUrl?: string;
  durationMinutes?: number;
  sortOrder: number;
  isRequired: boolean;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  progressPercent: number;
  currentLevel?: CourseLevel;
  startedAt: string;
  completedAt?: string;
}

export interface ProgressTracking {
  id: string;
  userId: string;
  lessonId: string;
  enrollmentId: string;
  isCompleted: boolean;
  score?: number;
  timeSpentSeconds: number;
  attempts: number;
  lastPositionSeconds: number;
}

export interface Assessment {
  id: string;
  courseId: string;
  title: MultiLangText;
  type: AssessmentType;
  level: CourseLevel;
  passingScore: number;
  timeLimitMinutes?: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  questionCount?: number;
  isFinal: boolean;
}

export interface Question {
  id: string;
  assessmentId?: string;
  questionText: MultiLangText;
  questionType: string;
  options?: Array<{ text: MultiLangText; isCorrect: boolean; explanation?: MultiLangText }>;
  correctAnswer?: Record<string, unknown>;
  difficulty: number;
  points: number;
  tags: string[];
}

export interface Certification {
  id: string;
  userId: string;
  courseId: string;
  level: CourseLevel;
  status: CertificationStatus;
  certificateNumber: string;
  qrCodeData?: string;
  pdfUrl?: string;
  issuedAt?: string;
  expiresAt?: string;
}

export interface LiveSession {
  id: string;
  courseId?: string;
  title: MultiLangText;
  description?: MultiLangText;
  trainerId: string;
  tenantId: string;
  status: LiveSessionStatus;
  bbbMeetingId?: string;
  scheduledAt: string;
  durationMinutes: number;
  maxParticipants: number;
  recordingUrl?: string;
  attendeeCount: number;
}

// JWT Payload
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantLevel: TenantLevel;
  iat: number;
  exp: number;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Kafka Events
export interface AcademyEvent<T = unknown> {
  eventId: string;
  eventType: string;
  version: string;
  timestamp: string;
  tenantId: string;
  userId?: string;
  payload: T;
}
