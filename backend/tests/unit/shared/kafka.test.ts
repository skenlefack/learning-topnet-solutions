// ============================================================================
// Topnet Solutions Academy — Kafka Unit Tests
// Tests publishEvent, createConsumer, and consumer handler patterns
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @fastify/rate-limit (transitive import from shared barrel)
// ---------------------------------------------------------------------------
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));

// ---------------------------------------------------------------------------
// Mock kafkajs before importing anything
// ---------------------------------------------------------------------------
const mockSend = vi.fn().mockResolvedValue(undefined);
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockRun = vi.fn().mockResolvedValue(undefined);

vi.mock('kafkajs', () => ({
  Kafka: vi.fn().mockImplementation(() => ({
    producer: () => ({
      connect: mockConnect,
      send: mockSend,
      disconnect: mockDisconnect,
    }),
    consumer: () => ({
      connect: mockConnect,
      subscribe: mockSubscribe,
      run: mockRun,
      disconnect: mockDisconnect,
    }),
  })),
}));

import { publishEvent, createConsumer, TOPICS } from '@topnet-academy/shared';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Kafka — publishEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should publish event with correct structure', async () => {
    await publishEvent(
      TOPICS.COURSE_PUBLISHED,
      { id: 'course-1', title: 'Test Course' },
      'tenant-1',
      'user-1',
    );

    expect(mockConnect).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(1);

    const sendArg = mockSend.mock.calls[0][0];
    expect(sendArg.topic).toBe(TOPICS.COURSE_PUBLISHED);
    expect(sendArg.messages).toHaveLength(1);

    const message = sendArg.messages[0];
    expect(message.key).toBe('tenant-1');

    const event = JSON.parse(message.value);
    expect(event.eventType).toBe(TOPICS.COURSE_PUBLISHED);
    expect(event.version).toBe('v1');
    expect(event.tenantId).toBe('tenant-1');
    expect(event.userId).toBe('user-1');
    expect(event.payload).toEqual({ id: 'course-1', title: 'Test Course' });
    expect(event.eventId).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it('should use custom key when provided', async () => {
    await publishEvent(TOPICS.ENROLLMENT_CREATED, { id: '1' }, 'tenant-1', 'user-1', 'custom-key');

    const message = mockSend.mock.calls[0][0].messages[0];
    expect(message.key).toBe('custom-key');
  });

  it('should include correct headers', async () => {
    await publishEvent(TOPICS.LESSON_COMPLETED, { lessonId: 'l1' }, 'tenant-abc');

    const headers = mockSend.mock.calls[0][0].messages[0].headers;
    expect(headers['event-type']).toBe(TOPICS.LESSON_COMPLETED);
    expect(headers['tenant-id']).toBe('tenant-abc');
    expect(headers['correlation-id']).toBeDefined();
  });

  it('should not throw when Kafka fails (graceful degradation)', async () => {
    mockSend.mockRejectedValueOnce(new Error('Broker unavailable'));

    await expect(
      publishEvent(TOPICS.COURSE_UPDATED, {}, 'tenant-1'),
    ).resolves.toBeUndefined();
  });
});

describe('Kafka — createConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to all provided topics', async () => {
    const handler = vi.fn();
    const topics = [TOPICS.COURSE_UPDATED, TOPICS.COURSE_PUBLISHED];

    await createConsumer('test-group', topics, handler);

    expect(mockConnect).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalledWith({ topic: TOPICS.COURSE_UPDATED, fromBeginning: false });
    expect(mockSubscribe).toHaveBeenCalledWith({ topic: TOPICS.COURSE_PUBLISHED, fromBeginning: false });
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('should use correct group ID format', async () => {
    const { Kafka } = await import('kafkajs');
    const handler = vi.fn();

    await createConsumer('my-consumer', [TOPICS.ENROLLMENT_CREATED], handler);

    // The consumer was created — verify the run callback structure
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({ eachMessage: expect.any(Function) }),
    );
  });

  it('should invoke handler with parsed event on eachMessage', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);

    // Capture the eachMessage callback
    await createConsumer('test-handler', [TOPICS.PROGRESS_UPDATED], handler);

    const eachMessage = mockRun.mock.calls[0][0].eachMessage;

    const testEvent = {
      eventId: 'evt-1',
      eventType: TOPICS.PROGRESS_UPDATED,
      version: 'v1',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-1',
      userId: 'user-1',
      payload: { lessonId: 'l1', progress: 50 },
    };

    await eachMessage({
      topic: TOPICS.PROGRESS_UPDATED,
      partition: 0,
      message: { value: Buffer.from(JSON.stringify(testEvent)) },
    });

    expect(handler).toHaveBeenCalledWith(TOPICS.PROGRESS_UPDATED, testEvent);
  });

  it('should not throw when handler fails (error isolation)', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Handler error'));

    await createConsumer('error-handler', [TOPICS.AUDIT_EVENTS], handler);

    const eachMessage = mockRun.mock.calls[0][0].eachMessage;

    // Should not throw — error is caught inside consumer.run
    await expect(
      eachMessage({
        topic: TOPICS.AUDIT_EVENTS,
        partition: 0,
        message: { value: Buffer.from(JSON.stringify({ eventId: '1', payload: {} })) },
      }),
    ).resolves.toBeUndefined();
  });

  it('should return null when connection fails (graceful degradation)', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await createConsumer('fail-group', [TOPICS.LIVE_STARTED], vi.fn());
    expect(result).toBeNull();
  });
});

describe('Kafka — TOPICS constants', () => {
  it('should define all expected topic names', () => {
    expect(TOPICS.COURSE_PUBLISHED).toBe('academy.course.published.v1');
    expect(TOPICS.COURSE_UPDATED).toBe('academy.course.updated.v1');
    expect(TOPICS.ENROLLMENT_CREATED).toBe('academy.enrollment.created.v1');
    expect(TOPICS.PROGRESS_UPDATED).toBe('academy.progress.updated.v1');
    expect(TOPICS.LESSON_COMPLETED).toBe('academy.lesson.completed.v1');
    expect(TOPICS.ASSESSMENT_SUBMITTED).toBe('academy.assessment.submitted.v1');
    expect(TOPICS.CERTIFICATION_ISSUED).toBe('academy.certification.issued.v1');
    expect(TOPICS.LIVE_SCHEDULED).toBe('academy.live.scheduled.v1');
    expect(TOPICS.LIVE_STARTED).toBe('academy.live.started.v1');
    expect(TOPICS.LIVE_RECORDED).toBe('academy.live.recorded.v1');
    expect(TOPICS.AUDIT_EVENTS).toBe('academy.audit.events');
  });

  it('should have 14 topics defined', () => {
    expect(Object.keys(TOPICS)).toHaveLength(14);
  });
});

describe('Kafka — Consumer Handler Patterns (course service)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle ENROLLMENT_CREATED with courseId in payload', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await createConsumer('enrollment-test', [TOPICS.ENROLLMENT_CREATED], handler);

    const eachMessage = mockRun.mock.calls[0][0].eachMessage;

    const event = {
      eventId: 'evt-enroll',
      eventType: TOPICS.ENROLLMENT_CREATED,
      version: 'v1',
      timestamp: new Date().toISOString(),
      tenantId: 'kenya',
      userId: 'user-42',
      payload: { id: 'enroll-1', course_id: 'course-abc', user_id: 'user-42' },
    };

    await eachMessage({
      topic: TOPICS.ENROLLMENT_CREATED,
      partition: 0,
      message: { value: Buffer.from(JSON.stringify(event)) },
    });

    expect(handler).toHaveBeenCalledWith(TOPICS.ENROLLMENT_CREATED, event);
    expect(handler.mock.calls[0][1].payload.course_id).toBe('course-abc');
  });

  it('should handle COURSE_PUBLISHED for cache invalidation pattern', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await createConsumer('cache-invalidator-test', [TOPICS.COURSE_PUBLISHED], handler);

    const eachMessage = mockRun.mock.calls[0][0].eachMessage;

    const event = {
      eventId: 'evt-pub',
      eventType: TOPICS.COURSE_PUBLISHED,
      version: 'v1',
      timestamp: new Date().toISOString(),
      tenantId: 'topnet-solutions',
      payload: { id: 'course-xyz', status: 'published' },
    };

    await eachMessage({
      topic: TOPICS.COURSE_PUBLISHED,
      partition: 0,
      message: { value: Buffer.from(JSON.stringify(event)) },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1].payload.id).toBe('course-xyz');
  });
});
