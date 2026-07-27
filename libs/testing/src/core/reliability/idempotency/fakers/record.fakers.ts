import type {
  CreateIdempotency,
  IdempotencyRecord,
  IdempotencyRedisRecord,
} from '@app/core/reliability/idempotency/persistence/idempotency.persistence.types';
import { Instant } from '@app/shared-kernel';
import { createFaker } from '@app/testing/faker-factory';
import { faker } from '@faker-js/faker';

export const fsRedisIdempotencyRecord = createFaker<IdempotencyRedisRecord>(() => ({
  requestHash: faker.string.alphanumeric({ length: 10 }),
  status: faker.helpers.arrayElement(['in_progress', 'completed', 'failed']),
  response: { data: faker.lorem.sentence() },
  error: { message: faker.lorem.sentence() },
}));

export const fsIdempotencyRecord = createFaker<IdempotencyRecord>(() => ({
  idempotencyKey: faker.string.uuid(),
  scope: faker.lorem.words(2).replace(/\s+/g, '-'),
  requestHash: faker.string.alphanumeric({ length: 10 }),
  status: faker.helpers.arrayElement(['in_progress', 'completed', 'failed']),
  response: { data: faker.lorem.sentence() },
  error: { message: faker.lorem.sentence() },
  createdAt: Instant.fromDate(faker.date.past()),
  expiresAt: Instant.fromDate(faker.date.future()),
  resolvedAt: faker.helpers.arrayElement([null, Instant.fromDate(faker.date.recent())]),
}));

export const fsCreateIdempotencyInput = createFaker<CreateIdempotency>(() => ({
  key: faker.string.uuid(),
  scope: faker.lorem.words(2).replace(/\s+/g, '-'),
  hash: faker.string.alphanumeric({ length: 64 }),
  ttl: faker.number.int({ min: 3_600, max: 86_400 }), // 1 hour to 1 day in seconds
}));
