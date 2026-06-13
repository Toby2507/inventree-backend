import { OutboxEvent, OutboxEventRow } from '@app/core/reliability/outbox/types/outbox.interface';
import { faker } from '@app/testing';
import { createClassFaker, createFaker } from '@app/testing/faker-factory';
import { FDEvent, FDEventPayload } from './event.faker';

export const fsOutboxEvent = createFaker<OutboxEvent>(() => ({
  id: faker.string.uuid(),
  storeId: faker.helpers.maybe(() => faker.string.uuid()),
  destination: faker.helpers.arrayElement(['bullmq']),
  status: faker.helpers.arrayElement(['cancelled', 'failed', 'locked', 'pending', 'published']),
  eventType: faker.word.words(2).replace(/\s/g, '_'),
  schemaVersion: faker.number.int({ min: 1, max: 10 }),
  aggregateType: faker.word.noun(),
  aggregateId: faker.string.uuid(),
  occurredAt: faker.date.recent(),
  traceId: faker.string.uuid(),
  correlationId: faker.string.uuid(),
  causationId: faker.string.uuid(),
  partitionKey: faker.string.uuid(),
  payload: { message: faker.lorem.sentence() },
  lockedAt: faker.date.recent(),
  lockedBy: faker.string.uuid(),
  lockExpiresAt: faker.date.recent(),
  publishAttempts: faker.number.int({ min: 0, max: 5 }),
  nextAttemptAt: faker.date.recent(),
  publishedAt: faker.date.recent(),
  publishRef: faker.string.uuid(),
  lastError: faker.lorem.sentence(),
  lastErrorAt: faker.date.recent(),
  createdAt: faker.date.recent(),
}));

export const fdOutboxEvent = createFaker<OutboxEventRow>(() => ({
  id: faker.string.uuid(),
  store_id: faker.string.uuid(),
  destination: faker.helpers.arrayElement(['bullmq']),
  status: faker.helpers.arrayElement(['cancelled', 'failed', 'locked', 'pending', 'published']),
  event_type: faker.word.words(2).replace(/\s/g, '_'),
  schema_version: faker.number.int({ min: 1, max: 10 }),
  aggregate_type: faker.word.noun(),
  aggregate_id: faker.string.uuid(),
  occurred_at: faker.date.recent(),
  trace_id: faker.string.uuid(),
  correlation_id: faker.string.uuid(),
  causation_id: faker.string.uuid(),
  partition_key: faker.string.uuid(),
  payload: { message: faker.lorem.sentence() },
  locked_at: faker.date.recent(),
  locked_by: faker.string.uuid(),
  lock_expires_at: faker.date.recent(),
  publish_attempts: faker.number.int({ min: 0, max: 5 }),
  next_attempt_at: faker.date.recent(),
  published_at: faker.date.recent(),
  publish_ref: faker.string.uuid(),
  last_error: faker.lorem.sentence(),
  last_error_at: faker.date.recent(),
  created_at: faker.date.recent(),
}));

export const feOutboxEvent = createClassFaker<FDEvent, FDEventPayload>(FDEvent, () => ({
  value: faker.word.words(10),
}));
