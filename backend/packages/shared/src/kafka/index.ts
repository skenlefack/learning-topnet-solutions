// ============================================================================
// Topnet Solutions Academy — Kafka Producer & Consumer
// Graceful degradation: publishes are no-ops if Kafka is unavailable
// ============================================================================
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { randomUUID } from 'crypto';
import { AcademyEvent } from '../types';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let kafkaAvailable = false;

function getKafka(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: process.env.SERVICE_NAME || 'academy-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: { retries: 3, initialRetryTime: 300 },
      connectionTimeout: 5000,
      requestTimeout: 10000,
    });
  }
  return kafka;
}

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = getKafka().producer({
      allowAutoTopicCreation: true,
    });
    await producer.connect();
    kafkaAvailable = true;
    console.log(`[Kafka] Producer connected (${process.env.SERVICE_NAME})`);
  }
  return producer;
}

export async function publishEvent<T>(
  topic: string,
  payload: T,
  tenantId: string,
  userId?: string,
  key?: string
): Promise<void> {
  try {
    const p = await getProducer();
    const event: AcademyEvent<T> = {
      eventId: randomUUID(),
      eventType: topic,
      version: 'v1',
      timestamp: new Date().toISOString(),
      tenantId,
      userId,
      payload,
    };
    await p.send({
      topic,
      messages: [{
        key: key || tenantId,
        value: JSON.stringify(event),
        headers: {
          'event-type': topic,
          'tenant-id': tenantId,
          'correlation-id': event.eventId,
        },
      }],
    });
  } catch (err: any) {
    console.warn(`[Kafka] Failed to publish to ${topic} (non-blocking):`, err.message);
  }
}

export async function createConsumer(
  groupId: string,
  topics: string[],
  handler: (topic: string, event: AcademyEvent) => Promise<void>
): Promise<Consumer | null> {
  try {
    const consumer = getKafka().consumer({
      groupId: `academy-${groupId}`,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    await consumer.connect();
    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await consumer.run({
      eachMessage: async ({ topic, message }: EachMessagePayload) => {
        try {
          const event = JSON.parse(message.value!.toString()) as AcademyEvent;
          await handler(topic, event);
        } catch (err) {
          console.error(`[Kafka] Error processing ${topic}:`, err);
        }
      },
    });

    kafkaAvailable = true;
    console.log(`[Kafka] Consumer ${groupId} subscribed to: ${topics.join(', ')}`);
    return consumer;
  } catch (err: any) {
    console.warn(`[Kafka] Consumer ${groupId} failed to connect (non-blocking):`, err.message);
    return null;
  }
}

// Topic constants
export const TOPICS = {
  // Course
  COURSE_PUBLISHED: 'academy.course.published.v1',
  COURSE_UPDATED: 'academy.course.updated.v1',
  COURSE_COMPLETED: 'academy.course.completed.v1',
  // Learning
  ENROLLMENT_CREATED: 'academy.enrollment.created.v1',
  PROGRESS_UPDATED: 'academy.progress.updated.v1',
  LESSON_COMPLETED: 'academy.lesson.completed.v1',
  // Assessment
  ASSESSMENT_SUBMITTED: 'academy.assessment.submitted.v1',
  ASSESSMENT_COMPLETED: 'academy.assessment.completed.v1',
  // Certification
  CERTIFICATION_PENDING: 'academy.certification.pending.v1',
  CERTIFICATION_ISSUED: 'academy.certification.issued.v1',
  // Live
  LIVE_SCHEDULED: 'academy.live.scheduled.v1',
  LIVE_STARTED: 'academy.live.started.v1',
  LIVE_RECORDED: 'academy.live.recorded.v1',
  // Commerce
  ORDER_CREATED: 'academy.order.created.v1',
  ORDER_PAID: 'academy.order.paid.v1',
  ORDER_FULFILLED: 'academy.order.fulfilled.v1',
  ORDER_CANCELED: 'academy.order.canceled.v1',
  ORDER_REFUNDED: 'academy.order.refunded.v1',
  PAYMENT_INITIATED: 'academy.payment.initiated.v1',
  PAYMENT_COMPLETED: 'academy.payment.completed.v1',
  PAYMENT_FAILED: 'academy.payment.failed.v1',
  WALLET_UPDATED: 'academy.wallet.updated.v1',
  COUPON_REDEEMED: 'academy.coupon.redeemed.v1',
  // Audit
  AUDIT_EVENTS: 'academy.audit.events',
} as const;
