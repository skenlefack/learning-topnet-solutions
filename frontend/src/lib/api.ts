// ============================================================================
// AU-IBAR Learning — API Client
// Typed fetch wrapper for all backend microservices
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface FetchOptions extends RequestInit {
  token?: string;
  params?: Record<string, string | number | undefined>;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, params, ...fetchOpts } = options;
  let url = `${BASE_URL}${path}`;

  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
    url += `?${qs.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOpts.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...fetchOpts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

// === Public API (no auth required) ===
export const publicApi = {
  stats: () =>
    apiFetch<{ success: boolean; data: { courses: number; enrollments: number; certifications: number; paths: number } }>('/api/public/stats'),
  courses: (params?: { limit?: number; offset?: number; lang?: string; level?: string; search?: string }) =>
    apiFetch<{ success: boolean; data: any[]; meta: { total: number; limit: number; offset: number } }>('/api/public/courses', { params }),
  course: (id: string, params?: { lang?: string }) =>
    apiFetch<{ success: boolean; data: any }>(`/api/public/courses/${id}`, { params }),
};

// === Categories API ===
export const categoryApi = {
  list: () => apiFetch<{ success: boolean; data: any[] }>('/api/courses/categories'),
  create: (token: string, data: any) => apiFetch('/api/courses/categories', { token, method: 'POST', body: JSON.stringify(data) }),
  update: (token: string, id: string, data: any) => apiFetch(`/api/courses/categories/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  delete: (token: string, id: string) => apiFetch(`/api/courses/categories/${id}`, { token, method: 'DELETE' }),
};

// === Learning Paths API ===
export const pathApi = {
  list: (token: string) => apiFetch<{ success: boolean; data: any[] }>('/api/courses/paths', { token }),
  listPublic: () => apiFetch<{ success: boolean; data: any[] }>('/api/courses/paths/public'),
  get: (token: string, id: string) => apiFetch<{ success: boolean; data: any }>(`/api/courses/paths/${id}`, { token }),
  create: (token: string, data: any) => apiFetch('/api/courses/paths', { token, method: 'POST', body: JSON.stringify(data) }),
  update: (token: string, id: string, data: any) => apiFetch(`/api/courses/paths/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  delete: (token: string, id: string) => apiFetch(`/api/courses/paths/${id}`, { token, method: 'DELETE' }),
  addCourse: (token: string, pathId: string, data: any) => apiFetch(`/api/courses/paths/${pathId}/courses`, { token, method: 'POST', body: JSON.stringify(data) }),
  removeCourse: (token: string, pathId: string, courseId: string) => apiFetch(`/api/courses/paths/${pathId}/courses/${courseId}`, { token, method: 'DELETE' }),
  enroll: (token: string, pathId: string) => apiFetch(`/api/courses/paths/${pathId}/enroll`, { token, method: 'POST' }),
};

// === Quiz/Questions API ===
export const questionApi = {
  list: (token: string, assessmentId: string) => apiFetch<{ success: boolean; data: any[] }>(`/api/assessment/questions/assessment/${assessmentId}`, { token }),
  create: (token: string, data: any) => apiFetch('/api/assessment/questions', { token, method: 'POST', body: JSON.stringify(data) }),
  update: (token: string, id: string, data: any) => apiFetch(`/api/assessment/questions/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  delete: (token: string, id: string) => apiFetch(`/api/assessment/questions/${id}`, { token, method: 'DELETE' }),
  bulkImport: (token: string, data: any) => apiFetch('/api/assessment/questions/bulk-import', { token, method: 'POST', body: JSON.stringify(data) }),
  export: (token: string, assessmentId: string) => apiFetch(`/api/assessment/questions/export?assessmentId=${assessmentId}`, { token }),
};

// === Path Exam API ===
export const pathExamApi = {
  start: (token: string, pathId: string) =>
    apiFetch<{ success: boolean; data: any }>('/api/assessment/path-exam/start', { token, method: 'POST', body: JSON.stringify({ pathId }) }),
  submit: (token: string, attemptId: string, answers: Record<string, any>) =>
    apiFetch<{ success: boolean; data: any }>('/api/assessment/path-exam/submit', { token, method: 'POST', body: JSON.stringify({ attemptId, answers }) }),
};

// === Resources API ===
export const resourceApi = {
  list: (token: string, params?: { courseId?: string; type?: string; limit?: number; offset?: number }) =>
    apiFetch<{ success: boolean; data: any[] }>('/api/courses/resources', { token, params }),
};

// === Trainer API ===
export const trainerApi = {
  myCourses: (token: string) =>
    apiFetch<{ success: boolean; data: any[] }>('/api/learning/admin/trainer/courses', { token }),
  courseAnalytics: (token: string, courseId: string) =>
    apiFetch<{ success: boolean; data: any }>(`/api/learning/admin/trainer/courses/${courseId}/analytics`, { token }),
};

// === Course Service ===
export const courseApi = {
  list: (token: string, params?: { level?: string; search?: string; page?: number; limit?: number; language?: string; sort?: string }) =>
    apiFetch<{ data: any[]; total: number; page: number; limit: number }>('/api/courses', { token, params }),
  get: (token: string, id: string) =>
    apiFetch(`/api/courses/${id}`, { token }),
  create: (token: string, data: any) =>
    apiFetch('/api/courses', { token, method: 'POST', body: JSON.stringify(data) }),
  update: (token: string, id: string, data: any) =>
    apiFetch(`/api/courses/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  delete: (token: string, id: string) =>
    apiFetch(`/api/courses/${id}`, { token, method: 'DELETE' }),
  modules: (token: string, courseId: string) =>
    apiFetch<{ data: any[] }>(`/api/courses/modules/course/${courseId}`, { token }),
};

// === Lesson helpers (via Learning Service) ===
export const lessonApi = {
  get: (token: string, lessonId: string) =>
    apiFetch<{ data: any }>(`/api/learning/lessons/${lessonId}`, { token }),
  context: (token: string, lessonId: string) =>
    apiFetch<{ data: { lesson: any; module: any; course: any; enrollment: any; progress: any; prev: string | null; next: string | null } }>(
      `/api/learning/lessons/${lessonId}/context`, { token },
    ),
};

// === Learning Service ===
export const learningApi = {
  enrollments: (token: string) =>
    apiFetch('/api/learning/enrollments', { token }),
  enroll: (token: string, courseId: string) =>
    apiFetch('/api/learning/enrollments', { token, method: 'POST', body: JSON.stringify({ courseId }) }),
  progress: (token: string, enrollmentId: string) =>
    apiFetch(`/api/learning/progress/${enrollmentId}`, { token }),
  updateProgress: (token: string, data: any) =>
    apiFetch('/api/learning/progress', { token, method: 'POST', body: JSON.stringify(data) }),
  dashboard: (token: string) =>
    apiFetch('/api/learning/dashboard', { token }),
  leaderboard: (token: string, params?: { period?: string; tenantId?: string; page?: number; limit?: number }) =>
    apiFetch('/api/learning/dashboard/leaderboard', { token, params }),
  videoHeartbeat: (token: string, data: { lessonId: string; enrollmentId: string; position: number; duration: number }) =>
    apiFetch('/api/learning/progress/video-heartbeat', { token, method: 'POST', body: JSON.stringify(data) }),
  videoResume: (token: string, lessonId: string) =>
    apiFetch(`/api/learning/progress/resume/${lessonId}`, { token }),
};

// === Assessment Service ===
export const assessmentApi = {
  forCourse: (token: string, courseId: string) =>
    apiFetch(`/api/assessment/course/${courseId}`, { token }),
  create: (token: string, data: any) =>
    apiFetch('/api/assessment/', { token, method: 'POST', body: JSON.stringify(data) }),
  startAttempt: (token: string, assessmentId: string, enrollmentId: string) =>
    apiFetch('/api/assessment/attempts/start', { token, method: 'POST', body: JSON.stringify({ assessmentId, enrollmentId }) }),
  submitAttempt: (token: string, attemptId: string, answers: any) =>
    apiFetch(`/api/assessment/attempts/${attemptId}/submit`, { token, method: 'POST', body: JSON.stringify({ answers }) }),
  certifications: (token: string) =>
    apiFetch('/api/assessment/certifications', { token }),
  verify: (certNumber: string) =>
    apiFetch(`/api/assessment/verify/${certNumber}`),
  bulkImport: (token: string, data: { assessmentId: string; questions: any[] }) =>
    apiFetch('/api/assessment/questions/bulk-import', { token, method: 'POST', body: JSON.stringify(data) }),
  export_: (token: string, assessmentId: string) =>
    apiFetch<{ data: any[] }>('/api/assessment/questions/export', { token, params: { assessmentId } }),
};

// === Live Service ===
export const liveApi = {
  sessions: (token: string) =>
    apiFetch('/api/live/sessions', { token }),
  upcoming: (token: string) =>
    apiFetch('/api/live/sessions/upcoming', { token }),
  forCourse: (token: string, courseId: string) =>
    apiFetch<{ data: any[] }>('/api/live/sessions', { token, params: { courseId } }),
  get: (token: string, id: string) =>
    apiFetch(`/api/live/sessions/${id}`, { token }),
  createSession: (token: string, data: any) =>
    apiFetch('/api/live/sessions', { token, method: 'POST', body: JSON.stringify(data) }),
  update: (token: string, id: string, data: any) =>
    apiFetch(`/api/live/sessions/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  cancel: (token: string, id: string) =>
    apiFetch(`/api/live/sessions/${id}`, { token, method: 'DELETE' }),
  join: (token: string, sessionId: string) =>
    apiFetch(`/api/live/sessions/${sessionId}/join`, { token }),
  end: (token: string, sessionId: string) =>
    apiFetch(`/api/live/sessions/${sessionId}/end`, { token, method: 'POST' }),
  attendance: (token: string, sessionId: string) =>
    apiFetch(`/api/live/sessions/${sessionId}/attendance`, { token }),
  recordings: (token: string, params?: { page?: number; limit?: number; courseId?: string }) =>
    apiFetch('/api/live/recordings', { token, params }),
  streamUrl: (token: string, sessionId: string) =>
    apiFetch(`/api/live/recordings/${sessionId}/stream`, { token }),
  deleteRecording: (token: string, sessionId: string) =>
    apiFetch(`/api/live/recordings/${sessionId}`, { token, method: 'DELETE' }),
};

// === Translation API (SYSTRAN) ===
export const translateApi = {
  translate: (texts: string[], source: string, target: string) =>
    apiFetch<{ success: boolean; translations: string[] }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ texts, source, target }),
    }),
};

// === Notification APIs ===
export const notificationApi = {
  list: (token: string, params?: { page?: number; limit?: number; unreadOnly?: string }) =>
    apiFetch<{ data: any[]; meta: any }>('/api/learning/notifications', { token, params }),
  unreadCount: (token: string) =>
    apiFetch<{ data: { count: number } }>('/api/learning/notifications/unread-count', { token }),
  markRead: (token: string, id: string) =>
    apiFetch(`/api/learning/notifications/${id}/read`, { token, method: 'PUT' }),
  markAllRead: (token: string) =>
    apiFetch('/api/learning/notifications/read-all', { token, method: 'PUT' }),
};

// === Search API ===
export const searchApi = {
  global: (token: string, params: { q: string; lang?: string }) =>
    apiFetch<{ data: { courses: any[]; modules: any[]; lessons: any[] } }>('/api/courses/search', { token, params }),
};

// === Community APIs ===
export const communityApi = {
  listPosts: (token: string, params?: { category?: string; page?: number; limit?: number }) =>
    apiFetch<{ data: any[]; meta: any }>('/api/learning/community/posts', { token, params }),
  getPost: (token: string, id: string) =>
    apiFetch<{ data: any }>(`/api/learning/community/posts/${id}`, { token }),
  createPost: (token: string, data: any) =>
    apiFetch('/api/learning/community/posts', { token, method: 'POST', body: JSON.stringify(data) }),
  upvote: (token: string, id: string) =>
    apiFetch(`/api/learning/community/posts/${id}/upvote`, { token, method: 'POST' }),
  listReplies: (token: string, postId: string) =>
    apiFetch<{ data: any[] }>(`/api/learning/community/posts/${postId}/replies`, { token }),
  listGroups: (token: string, params?: { page?: number; limit?: number }) =>
    apiFetch<{ data: any[]; meta: any }>('/api/learning/community/groups', { token, params }),
  createGroup: (token: string, data: any) =>
    apiFetch('/api/learning/community/groups', { token, method: 'POST', body: JSON.stringify(data) }),
  joinGroup: (token: string, groupId: string) =>
    apiFetch(`/api/learning/community/groups/${groupId}/join`, { token, method: 'POST' }),
  leaveGroup: (token: string, groupId: string) =>
    apiFetch(`/api/learning/community/groups/${groupId}/leave`, { token, method: 'POST' }),
};

// === Profile APIs ===
export const profileApi = {
  me: (token: string) =>
    apiFetch<{ data: any }>('/api/learning/users/me', { token }),
  update: (token: string, data: { firstName?: string; lastName?: string; preferredLanguage?: string }) =>
    apiFetch<{ data: any }>('/api/learning/users/me', { token, method: 'PUT', body: JSON.stringify(data) }),
  uploadAvatar: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${BASE_URL}/api/learning/users/me/avatar`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `API Error: ${res.status}`);
    }
    return res.json();
  },
};

// === Admin APIs ===
export const adminApi = {
  stats: (token: string) =>
    apiFetch('/api/learning/admin/stats', { token }),
  users: (token: string, params?: { page?: number; limit?: number; search?: string; role?: string }) =>
    apiFetch('/api/learning/admin/users', { token, params }),
  createUser: (token: string, data: any) =>
    apiFetch('/api/learning/admin/users', { token, method: 'POST', body: JSON.stringify(data) }),
  updateUser: (token: string, id: string, data: any) =>
    apiFetch(`/api/learning/admin/users/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  bulkImportUsers: (token: string, users: any[]) =>
    apiFetch('/api/learning/admin/users/bulk-import', { token, method: 'POST', body: JSON.stringify({ users }) }),
  tenants: (token: string) =>
    apiFetch<{ data: any[] }>('/api/learning/admin/tenants', { token }),
  courseAnalytics: (token: string, courseId: string) =>
    apiFetch(`/api/learning/admin/courses/${courseId}/analytics`, { token }),
  pathsAnalytics: (token: string) =>
    apiFetch('/api/learning/admin/paths/analytics', { token }),
  engagement: (token: string) =>
    apiFetch('/api/learning/admin/engagement', { token }),
  exportReport: (token: string, params?: { courseId?: string; pathId?: string; status?: string }) =>
    apiFetch('/api/learning/admin/reports/export', { token, params }),
  exportExcel: (token: string, params?: { courseId?: string; status?: string }) =>
    `/api/learning/admin/reports/excel?${new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as [string, string][]).toString()}`,
  tenantsCompare: (token: string) =>
    apiFetch<{ success: boolean; data: any[] }>('/api/learning/admin/tenants/compare', { token }),
};
