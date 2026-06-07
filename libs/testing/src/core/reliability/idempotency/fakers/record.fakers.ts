import {
  IdempotencyRecord,
  IdempotencyRedisRecord,
} from '@app/core/reliability/idempotency/persistence/idempotency.persistence.types';
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
  createdAt: faker.date.past(),
  expiresAt: faker.date.future(),
  resolvedAt: faker.helpers.arrayElement([null, faker.date.recent()]),
}));
