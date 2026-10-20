// ============================================================================
// Topnet Solutions Academy — MSW Request Handlers
// ============================================================================
import { http, HttpResponse } from 'msw';
import {
  mockCourses,
  mockEnrollments,
  mockLiveSessions,
  mockCertifications,
  mockModules,
  mockDashboard,
  mockLessonContext,
  mockVerification,
  mockUser,
} from './data';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export const handlers = [
  // -- Course Service --
  http.get(`${API}/api/courses`, () =>
    HttpResponse.json({ data: mockCourses, total: mockCourses.length, page: 1, limit: 20 }),
  ),

  http.get(`${API}/api/courses/:id`, ({ params }) => {
    const course = mockCourses.find((c) => c.id === params.id);
    return course
      ? HttpResponse.json({ data: course })
      : HttpResponse.json({ error: 'Not found' }, { status: 404 });
  }),

  http.post(`${API}/api/courses`, async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      data: { id: 'course-new', ...body, moduleCount: 0, enrollmentCount: 0 },
    }, { status: 201 });
  }),

  http.get(`${API}/api/courses/modules/course/:courseId`, () =>
    HttpResponse.json({ data: mockModules }),
  ),

  // -- Learning Service --
  http.get(`${API}/api/learning/enrollments`, () =>
    HttpResponse.json({ data: mockEnrollments }),
  ),

  http.post(`${API}/api/learning/enrollments`, async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      data: {
        id: 'enroll-new',
        courseId: body.courseId,
        status: 'active',
        progress: 0,
      },
    }, { status: 201 });
  }),

  http.get(`${API}/api/learning/progress/:enrollmentId`, () =>
    HttpResponse.json({
      data: [
        { lessonId: 'lesson-001', is_completed: true },
        { lessonId: 'lesson-002', is_completed: false },
      ],
    }),
  ),

  http.post(`${API}/api/learning/progress`, () =>
    HttpResponse.json({ success: true }),
  ),

  http.post(`${API}/api/learning/progress/video-heartbeat`, () =>
    HttpResponse.json({ success: true }),
  ),

  http.get(`${API}/api/learning/progress/resume/:lessonId`, () =>
    HttpResponse.json({ data: { position: 120 } }),
  ),

  http.get(`${API}/api/learning/dashboard`, () =>
    HttpResponse.json({ data: mockDashboard }),
  ),

  http.get(`${API}/api/learning/dashboard/leaderboard`, () =>
    HttpResponse.json({
      data: [
        { userId: 'usr-001', name: 'Amina Wanjiku', score: 950, rank: 1 },
        { userId: 'usr-002', name: 'Kwame Asante', score: 880, rank: 2 },
      ],
    }),
  ),

  // -- Lesson context --
  http.get(`${API}/api/learning/lessons/:lessonId/context`, () =>
    HttpResponse.json({ data: mockLessonContext }),
  ),

  http.get(`${API}/api/learning/lessons/:lessonId`, ({ params }) =>
    HttpResponse.json({ data: { id: params.lessonId, ...mockLessonContext.lesson } }),
  ),

  // -- Assessment Service --
  http.get(`${API}/api/assessment/course/:courseId`, () =>
    HttpResponse.json({
      data: [
        { id: 'assess-001', type: 'final', passingScore: 70, questionCount: 20 },
      ],
    }),
  ),

  http.post(`${API}/api/assessment/attempts/start`, () =>
    HttpResponse.json({
      data: {
        id: 'attempt-001',
        status: 'in_progress',
        questions: mockLessonContext.lesson,
      },
    }),
  ),

  http.post(`${API}/api/assessment/attempts/:attemptId/submit`, () =>
    HttpResponse.json({
      data: { score: 85, passed: true, certNumber: 'ARIS-2024-KE-00143' },
    }),
  ),

  http.get(`${API}/api/assessment/certifications`, () =>
    HttpResponse.json({ data: mockCertifications }),
  ),

  http.get(`${API}/api/assessment/verify/:certNumber`, () =>
    HttpResponse.json({ data: mockVerification }),
  ),

  // -- Live Service --
  http.get(`${API}/api/live/sessions`, () =>
    HttpResponse.json({ data: mockLiveSessions }),
  ),

  http.get(`${API}/api/live/sessions/upcoming`, () =>
    HttpResponse.json({ data: mockLiveSessions.filter((s) => s.status === 'scheduled') }),
  ),

  http.post(`${API}/api/live/sessions/:id/join`, () =>
    HttpResponse.json({ data: { joinUrl: 'https://meet.example.com/live-001' } }),
  ),

  // -- Notifications --
  http.get(`${API}/api/learning/notifications/unread-count`, () =>
    HttpResponse.json({ data: { count: 3 } }),
  ),

  http.get(`${API}/api/learning/notifications`, () =>
    HttpResponse.json({
      data: [
        {
          id: 'notif-001',
          type: 'enrollment',
          title: { fr: 'Inscription confirmee', en: 'Enrollment confirmed' },
          body: { fr: 'Vous etes inscrit au cours', en: 'You are enrolled in the course' },
          is_read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: 'notif-002',
          type: 'certification',
          title: { fr: 'Certification obtenue', en: 'Certification earned' },
          body: { fr: 'Felicitations !', en: 'Congratulations!' },
          is_read: true,
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    }),
  ),

  http.put(`${API}/api/learning/notifications/:id/read`, () =>
    HttpResponse.json({ success: true }),
  ),

  http.put(`${API}/api/learning/notifications/read-all`, () =>
    HttpResponse.json({ success: true }),
  ),

  // -- Community --
  http.get(`${API}/api/learning/community/posts`, () =>
    HttpResponse.json({
      data: [
        {
          id: 'post-001',
          author_first_name: 'Amina',
          author_last_name: 'Wanjiku',
          category: 'general',
          title: { fr: 'Bienvenue sur le forum', en: 'Welcome to the forum' },
          body: { fr: 'Presentation du forum', en: 'Forum introduction' },
          upvotes: 5,
          reply_count: 2,
          created_at: new Date().toISOString(),
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    }),
  ),

  http.get(`${API}/api/learning/community/posts/:id/replies`, () =>
    HttpResponse.json({ data: [] }),
  ),

  http.post(`${API}/api/learning/community/posts`, () =>
    HttpResponse.json({ data: { id: 'post-new' } }, { status: 201 }),
  ),

  http.get(`${API}/api/learning/community/groups`, () =>
    HttpResponse.json({
      data: [
        {
          id: 'group-001',
          name: { fr: 'Groupe Surveillance', en: 'Surveillance Group' },
          member_count: 5,
          max_members: 20,
          is_member: false,
          creator_first_name: 'Jean',
          creator_last_name: 'Mbeki',
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    }),
  ),

  // -- Profile --
  http.get(`${API}/api/learning/users/me`, () =>
    HttpResponse.json({
      data: {
        ...mockUser,
        first_name: mockUser.firstName,
        last_name: mockUser.lastName,
        preferred_language: mockUser.preferredLanguage,
        avatar_url: mockUser.avatarUrl,
        tenant: { id: 'tenant-kenya', name: 'Kenya', code: 'KE', level: 'country' },
      },
    }),
  ),

  http.put(`${API}/api/learning/users/me`, async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      data: {
        ...mockUser,
        first_name: body.firstName || mockUser.firstName,
        last_name: body.lastName || mockUser.lastName,
        preferred_language: body.preferredLanguage || mockUser.preferredLanguage,
      },
    });
  }),

  // -- Admin --
  http.get(`${API}/api/learning/admin/stats`, () =>
    HttpResponse.json({
      data: {
        totalLearners: 1250,
        activeCourses: 12,
        certificationsIssued: 340,
        countriesConnected: 42,
      },
    }),
  ),
];
