// ============================================================================
// ARIS Academy — Attendance Tracking & Analytics Routes
// GET /sessions/:id/attendance — Attendance report (trainer/admin)
// GET /sessions/:id/attendance/export — Export attendance as CSV
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  query, queryOne,
  UuidParam, BearerSecurity,
} from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape double quotes and wrap in quotes if the value contains commas, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function attendanceRoutes(app: FastifyInstance) {

  // ==========================================================================
  // GET /sessions/:id/attendance — Detailed attendance report
  // ==========================================================================
  app.get<{ Params: { id: string } }>('/:id/attendance', {
    schema: {
      summary: 'Detailed attendance report',
      tags: ['Attendance'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = req.user;

    // Only trainer/admins can see full attendance data
    if (!['trainer', 'admin_country', 'admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!session) {
      return reply.code(404).send({ success: false, error: 'Session not found' });
    }

    // Trainers can only view attendance for their own sessions
    if (user.role === 'trainer' && user.sub !== session.trainer_id) {
      return reply.code(403).send({ success: false, error: 'You can only view attendance for your own sessions' });
    }

    const attendance = await query(`
      SELECT
        la.user_id,
        la.joined_at,
        la.left_at,
        la.duration_seconds,
        u.first_name,
        u.last_name,
        u.email,
        CASE
          WHEN la.left_at IS NOT NULL THEN la.duration_seconds
          WHEN $2 = 'live' THEN EXTRACT(EPOCH FROM (NOW() - la.joined_at))::INTEGER
          ELSE la.duration_seconds
        END AS effective_duration_seconds
      FROM academy_core.live_attendance la
      JOIN academy_core.users u ON u.id = la.user_id
      WHERE la.session_id = $1
      ORDER BY la.joined_at ASC
    `, [req.params.id, session.status]);

    // Calculate session total duration in seconds
    const sessionDurationSeconds = (session.duration_minutes || 60) * 60;

    // Compute attendance percentage for each participant
    const attendanceWithPercent = attendance.map((a: any) => {
      const effectiveDuration = a.effective_duration_seconds || 0;
      const attendancePercent = sessionDurationSeconds > 0
        ? Math.min(100, Math.round((effectiveDuration / sessionDurationSeconds) * 100))
        : 0;

      return {
        userId: a.user_id,
        firstName: a.first_name,
        lastName: a.last_name,
        email: a.email,
        joinedAt: a.joined_at,
        leftAt: a.left_at,
        durationSeconds: effectiveDuration,
        durationFormatted: formatDuration(effectiveDuration),
        attendancePercent,
      };
    });

    // Aggregate statistics
    const totalParticipants = attendanceWithPercent.length;
    const durations = attendanceWithPercent.map((a: any) => a.durationSeconds || 0);
    const avgDurationSeconds = totalParticipants > 0
      ? Math.round(durations.reduce((sum: number, d: number) => sum + d, 0) / totalParticipants)
      : 0;
    const avgAttendancePercent = totalParticipants > 0
      ? Math.round(
          attendanceWithPercent.reduce((sum: number, a: any) => sum + a.attendancePercent, 0)
          / totalParticipants,
        )
      : 0;

    // Count participants with > 75% attendance (considered "present")
    const presentCount = attendanceWithPercent.filter(
      (a: any) => a.attendancePercent >= 75,
    ).length;

    const stats = {
      totalParticipants,
      presentCount,
      absentCount: totalParticipants - presentCount,
      avgDurationSeconds,
      avgDurationFormatted: formatDuration(avgDurationSeconds),
      avgAttendancePercent,
      sessionDurationMinutes: session.duration_minutes,
      sessionStatus: session.status,
    };

    return reply.send({ success: true, data: { attendance: attendanceWithPercent, stats } });
  });

  // ==========================================================================
  // GET /sessions/:id/attendance/export — Export attendance as CSV download
  // ==========================================================================
  app.get<{ Params: { id: string } }>('/:id/attendance/export', {
    schema: {
      summary: 'Export attendance as CSV',
      tags: ['Attendance'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = req.user;

    // Only trainer/admins can export attendance
    if (!['trainer', 'admin_country', 'admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!session) {
      return reply.code(404).send({ success: false, error: 'Session not found' });
    }

    // Trainers can only export attendance for their own sessions
    if (user.role === 'trainer' && user.sub !== session.trainer_id) {
      return reply.code(403).send({ success: false, error: 'You can only export attendance for your own sessions' });
    }

    const attendance = await query(`
      SELECT
        la.joined_at,
        la.left_at,
        la.duration_seconds,
        u.first_name,
        u.last_name,
        u.email,
        CASE
          WHEN la.left_at IS NOT NULL THEN la.duration_seconds
          WHEN $2 = 'live' THEN EXTRACT(EPOCH FROM (NOW() - la.joined_at))::INTEGER
          ELSE la.duration_seconds
        END AS effective_duration_seconds
      FROM academy_core.live_attendance la
      JOIN academy_core.users u ON u.id = la.user_id
      WHERE la.session_id = $1
      ORDER BY la.joined_at ASC
    `, [req.params.id, session.status]);

    // Build session title string for the filename
    const sessionTitle = typeof session.title === 'object'
      ? (session.title.en || session.title.fr || 'Session')
      : (session.title || 'Session');
    const safeTitle = sessionTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    const dateStr = session.scheduled_at
      ? new Date(session.scheduled_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Build CSV content
    const headers = ['Name', 'Email', 'Joined At', 'Left At', 'Duration (minutes)', 'Duration (formatted)'];
    const rows = attendance.map((a: any) => {
      const effectiveDuration = a.effective_duration_seconds || 0;
      const durationMinutes = Math.round(effectiveDuration / 60);
      return [
        escapeCSV(`${a.first_name || ''} ${a.last_name || ''}`.trim()),
        escapeCSV(a.email),
        escapeCSV(a.joined_at ? new Date(a.joined_at).toISOString() : ''),
        escapeCSV(a.left_at ? new Date(a.left_at).toISOString() : ''),
        String(durationMinutes),
        escapeCSV(formatDuration(effectiveDuration)),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="attendance_${safeTitle}_${dateStr}.csv"`)
      .send(csv);
  });
}
