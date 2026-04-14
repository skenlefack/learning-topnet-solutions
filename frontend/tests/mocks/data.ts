// ============================================================================
// ARIS Academy — Shared Mock Data for Tests
// ============================================================================

export const mockUser = {
  id: 'usr-001',
  email: 'amina@example.ke',
  firstName: 'Amina',
  lastName: 'Wanjiku',
  role: 'learner',
  tenantId: 'tenant-kenya',
  tenantLevel: 'country',
  preferredLanguage: 'fr',
  avatarUrl: null,
};

export const mockAdminUser = {
  ...mockUser,
  id: 'usr-admin-001',
  email: 'admin@au-ibar.org',
  firstName: 'Jean',
  lastName: 'Admin',
  role: 'admin_continental',
};

export const mockToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock';

export const mockCourses = [
  {
    id: 'course-001',
    title: { fr: 'Introduction à ARIS 3.0', en: 'Introduction to ARIS 3.0' },
    description: { fr: 'Fondamentaux du système ARIS', en: 'ARIS system fundamentals' },
    level: 'beginner',
    duration: '4h',
    moduleCount: 3,
    enrollmentCount: 150,
    thumbnail: null,
  },
  {
    id: 'course-002',
    title: { fr: 'Gestion avancée des ressources', en: 'Advanced Resource Management' },
    description: { fr: 'Techniques avancées de gestion', en: 'Advanced management techniques' },
    level: 'intermediate',
    duration: '8h',
    moduleCount: 5,
    enrollmentCount: 87,
    thumbnail: null,
  },
  {
    id: 'course-003',
    title: { fr: 'Expertise ARIS', en: 'ARIS Expertise' },
    description: { fr: 'Certification expert ARIS', en: 'ARIS expert certification' },
    level: 'expert',
    duration: '16h',
    moduleCount: 8,
    enrollmentCount: 23,
    thumbnail: null,
  },
];

export const mockEnrollments = [
  {
    id: 'enroll-001',
    courseId: 'course-001',
    course_id: 'course-001',
    userId: 'usr-001',
    status: 'active',
    progress: 65,
    courseName: 'Introduction à ARIS 3.0',
    course: mockCourses[0],
    countryCode: 'KE',
  },
  {
    id: 'enroll-002',
    courseId: 'course-002',
    course_id: 'course-002',
    userId: 'usr-001',
    status: 'active',
    progress: 30,
    courseName: 'Gestion avancée des ressources',
    course: mockCourses[1],
    countryCode: 'KE',
  },
];

export const mockLiveSessions = [
  {
    id: 'live-001',
    title: { fr: 'Atelier pratique ARIS', en: 'ARIS Practical Workshop' },
    status: 'live',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    trainer: 'Dr. Kwame Asante',
    participantCount: 34,
  },
  {
    id: 'live-002',
    title: { fr: 'Session Q&A Module 2', en: 'Module 2 Q&A Session' },
    status: 'scheduled',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    trainer: 'Prof. Fatou Diallo',
    participantCount: 0,
  },
  {
    id: 'live-003',
    title: { fr: 'Révision certification', en: 'Certification Review' },
    status: 'scheduled',
    startTime: new Date(Date.now() + 172800000).toISOString(),
    endTime: new Date(Date.now() + 172800000 + 5400000).toISOString(),
    trainer: 'Dr. Ngozi Okafor',
    participantCount: 0,
  },
];

export const mockCertifications = [
  {
    id: 'cert-001',
    level: 'foundation',
    certLevel: 'foundation',
    status: 'issued',
    courseName: 'Introduction à ARIS 3.0',
    certNumber: 'ARIS-2024-KE-00142',
    issuedAt: '2024-06-15T00:00:00Z',
    title: 'Foundation ARIS',
  },
  {
    id: 'cert-002',
    level: 'intermediate',
    certLevel: 'intermediate',
    status: 'in_progress',
    courseName: 'Gestion avancée des ressources',
    title: 'Intermediate ARIS',
  },
];

export const mockModules = [
  {
    id: 'mod-001',
    title: { fr: 'Module 1 : Bases', en: 'Module 1: Basics' },
    sort_order: 1,
    lessons: [
      { id: 'lesson-001', title: { fr: 'Introduction vidéo', en: 'Video Introduction' }, type: 'video', sort_order: 1, duration_minutes: 15 },
      { id: 'lesson-002', title: { fr: 'Concepts clés', en: 'Key Concepts' }, type: 'text', sort_order: 2, duration_minutes: 10 },
      { id: 'lesson-003', title: { fr: 'Quiz Module 1', en: 'Module 1 Quiz' }, type: 'quiz', sort_order: 3, duration_minutes: 5 },
    ],
  },
  {
    id: 'mod-002',
    title: { fr: 'Module 2 : Pratique', en: 'Module 2: Practice' },
    sort_order: 2,
    lessons: [
      { id: 'lesson-004', title: { fr: 'Exercice pratique', en: 'Practical Exercise' }, type: 'practical', sort_order: 1, duration_minutes: 30 },
    ],
  },
];

export const mockQuizLesson = {
  id: 'lesson-003',
  title: { fr: 'Quiz Module 1', en: 'Module 1 Quiz' },
  type: 'quiz',
  course_id: 'course-001',
  content: {
    passingScore: 70,
    totalTime: 300,
    questions: [
      {
        id: 'q1',
        text: { fr: 'Quelle est la version actuelle d\'ARIS ?', en: 'What is the current version of ARIS?' },
        options: [
          { id: 'q1-a', text: { fr: 'ARIS 1.0', en: 'ARIS 1.0' }, isCorrect: false },
          { id: 'q1-b', text: { fr: 'ARIS 2.0', en: 'ARIS 2.0' }, isCorrect: false },
          { id: 'q1-c', text: { fr: 'ARIS 3.0', en: 'ARIS 3.0' }, isCorrect: true },
          { id: 'q1-d', text: { fr: 'ARIS 4.0', en: 'ARIS 4.0' }, isCorrect: false },
        ],
        explanation: { fr: 'ARIS 3.0 est la version actuelle déployée.', en: 'ARIS 3.0 is the current deployed version.' },
      },
      {
        id: 'q2',
        text: { fr: 'Combien de pays utilisent ARIS ?', en: 'How many countries use ARIS?' },
        options: [
          { id: 'q2-a', text: { fr: '10', en: '10' }, isCorrect: false },
          { id: 'q2-b', text: { fr: '55', en: '55' }, isCorrect: true },
          { id: 'q2-c', text: { fr: '30', en: '30' }, isCorrect: false },
        ],
        explanation: { fr: '55 pays africains utilisent le système ARIS.', en: '55 African countries use the ARIS system.' },
      },
      {
        id: 'q3',
        text: { fr: 'Quel organisme gère ARIS ?', en: 'Which organization manages ARIS?' },
        options: [
          { id: 'q3-a', text: { fr: 'AU-IBAR', en: 'AU-IBAR' }, isCorrect: true },
          { id: 'q3-b', text: { fr: 'FAO', en: 'FAO' }, isCorrect: false },
          { id: 'q3-c', text: { fr: 'OMS', en: 'WHO' }, isCorrect: false },
        ],
      },
    ],
  },
};

export const mockDashboard = {
  enrollments: mockEnrollments,
  totalLearningHours: 42,
  streak: { current_streak: 5, last_active: new Date().toISOString() },
  activeCourses: 2,
  completedCourses: 1,
};

export const mockLesson = {
  id: 'lesson-001',
  title: { fr: 'Introduction vidéo', en: 'Video Introduction' },
  type: 'video',
  course_id: 'course-001',
  video_url: 'https://example.com/video.mp4',
  content: {
    description: { fr: 'Introduction au système ARIS', en: 'Introduction to the ARIS system' },
  },
};

export const mockLessonContext = {
  lesson: mockLesson,
  module: mockModules[0],
  course: mockCourses[0],
  enrollment: mockEnrollments[0],
  progress: { is_completed: false, last_position_seconds: 120 },
  prev: null,
  next: 'lesson-002',
};

export const mockVerification = {
  valid: true,
  certificate: {
    certNumber: 'ARIS-2024-KE-00142',
    holderName: 'Amina Wanjiku',
    courseName: 'Introduction à ARIS 3.0',
    level: 'foundation',
    issuedAt: '2024-06-15T00:00:00Z',
    tenantName: 'Kenya',
  },
};
