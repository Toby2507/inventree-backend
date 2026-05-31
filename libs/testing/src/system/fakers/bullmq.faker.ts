import { JobPayload } from '@app/core/observability/wrappers';
import { createFaker } from '@app/testing/faker-factory';
import { faker } from '@faker-js/faker';
import { Job } from 'bullmq';

export const fsJob = createFaker<Job<JobPayload<Record<string, unknown>>>>(
  () =>
    ({
      id: faker.string.uuid(),
      name: faker.word.words(2).replace(/\s/g, '-'),
      attemptsMade: faker.number.int({ min: 0, max: 3 }),
      data: {
        data: { to: faker.internet.email() },
        _obs: {
          correlationId: faker.string.uuid(),
          causationId: faker.string.uuid(),
          idempotencyKey: faker.string.uuid(),
          actorUserId: faker.string.uuid(),
          actorStoreId: faker.string.uuid(),
          actorRole: faker.helpers.arrayElement(['owner', 'manager', 'staff', 'attendant']),
        },
      },
    }) as unknown as Job<JobPayload<Record<string, unknown>>>,
);
