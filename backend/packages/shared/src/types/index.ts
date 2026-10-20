// ============================================================================
// Topnet Solutions Academy — Shared Types
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

// ============================================================================
// Commerce Types
// ============================================================================

export type OfferKind = 'course_access' | 'credits' | 'unlimited_pass' | 'test_unlock' | 'pack' | 'service';
export type OrderStatus = 'pending' | 'awaiting' | 'processing' | 'paid' | 'rejected' | 'canceled' | 'refunded';
export type ProviderIntegrationType = 'api' | 'redirect' | 'manual' | 'wallet';
export type CouponKind = 'percent' | 'credit' | 'fixed_amount';
export type ServiceKind = 'coaching' | 'mentoring' | 'training';
export type ServiceStatus = 'to_schedule' | 'scheduled' | 'in_progress' | 'completed' | 'canceled';

export interface PaymentProvider {
  id: string;
  tenantId: string;
  adapterName: string;
  integrationType: ProviderIntegrationType;
  displayName: MultiLangText;
  description?: MultiLangText;
  logoUrl?: string;
  config: Record<string, unknown>;
  supportedCurrencies: string[];
  webhookPath?: string;
  isActive: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
}

export interface Offer {
  id: string;
  tenantId: string;
  code: string;
  kind: OfferKind;
  name: MultiLangText;
  tagline?: MultiLangText;
  description?: MultiLangText;
  price: number;
  currency: string;
  priceIncludesTax: boolean;
  taxRate: number;
  credits: number;
  days: number;
  voucherCount: number;
  services: string[];
  courseIds: string[];
  assessmentIds: string[];
  maxInstallments: number;
  features: unknown[];
  isHighlighted: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface Order {
  id: string;
  tenantId: string;
  ref: string;
  userId: string;
  offerId: string;
  targetCourseId?: string;
  targetAssessmentId?: string;
  amount: number;
  totalAmount: number;
  discount: number;
  currency: string;
  couponCode?: string;
  installmentNo: number;
  installmentsTotal: number;
  parentOrderId?: string;
  dueAt?: string;
  providerId?: string;
  paymentMethod?: string;
  status: OrderStatus;
  payerName?: string;
  payerPhone?: string;
  proofRef?: string;
  providerRef?: string;
  sponsorToken?: string;
  adminNote?: string;
  validatedBy?: string;
  paidAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  orderId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: string;
  providerRef?: string;
  providerResponse?: Record<string, unknown>;
  redirectUrl?: string;
  callbackUrl?: string;
  idempotencyKey?: string;
}

export interface UserWallet {
  id: string;
  tenantId: string;
  userId: string;
  credits: number;
  freeTests: number;
  unlimitedUntil?: string;
  refCode: string;
  referredBy?: string;
  referralRewarded: boolean;
}

export interface Coupon {
  id: string;
  tenantId: string;
  code: string;
  kind: CouponKind;
  value: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  org: string;
  sourceOrderId?: string;
  ownerId?: string;
  isActive: boolean;
}

export interface PurchasedService {
  id: string;
  tenantId: string;
  userId: string;
  orderId: string;
  kind: ServiceKind;
  track?: string;
  pace?: string;
  status: ServiceStatus;
  request?: string;
  scheduledAt?: string;
  notes?: string;
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
