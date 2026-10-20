// ============================================================================
// Kafka Consumers for Commerce Service
// ============================================================================
import { createConsumer, TOPICS, type AcademyEvent } from '@topnet-academy/shared';

export async function initConsumers(): Promise<void> {
  // Listen for assessment completion to generate cert codes for unlocked tests
  await createConsumer(
    'commerce-listener',
    [TOPICS.ASSESSMENT_COMPLETED],
    async (topic, event: AcademyEvent) => {
      if (topic === TOPICS.ASSESSMENT_COMPLETED) {
        const payload = event.payload as {
          assessmentId?: string;
          userId?: string;
          passed?: boolean;
        };
        console.log(
          `[Commerce] Assessment completed: ${payload.assessmentId} by ${payload.userId} (passed: ${payload.passed})`,
        );
        // Future: auto-generate certificate codes for skill tests
      }
    },
  );
}
