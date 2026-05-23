import { ObservationContext } from '@app/core/observability/context';
import { faker } from '@faker-js/faker';
import { createFaker } from '../../faker-factory';
import { makeMockSpan } from '../mocks/otel.mocks';

export const fsObservationContext = createFaker<ObservationContext>(() => ({
  correlationId: faker.string.uuid(),
  traceId: faker.string.hexadecimal({ length: 32, prefix: '' }),
  causationId: faker.string.uuid(),
  idempotencyKey: faker.string.uuid(),
  rootSpan: makeMockSpan() as any,
  actor: {
    userId: faker.string.uuid(),
    storeId: faker.string.uuid(),
    role: faker.helpers.arrayElement(['owner', 'manager', 'staff', 'attendant']),
  },
}));
