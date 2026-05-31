import { ObservationContext, SerializedOutboxContext } from '@app/core/observability/context';
import { faker } from '@faker-js/faker';
import { createFaker } from '../../faker-factory';

export const fsObservationContext = createFaker<ObservationContext>(() => ({
  correlationId: faker.string.uuid(),
  causationId: faker.string.uuid(),
  idempotencyKey: faker.string.uuid(),
  actor: {
    userId: faker.string.uuid(),
    storeId: faker.string.uuid(),
    role: faker.helpers.arrayElement(['owner', 'manager', 'staff', 'attendant']),
  },
}));

export const fsSerializedBusinessContext = createFaker<SerializedOutboxContext>(() => ({
  correlationId: faker.string.uuid(),
  causationId: faker.string.uuid(),
  idempotencyKey: faker.string.uuid(),
  actorUserId: faker.string.uuid(),
  actorStoreId: faker.string.uuid(),
  actorRole: faker.helpers.arrayElement(['owner', 'manager', 'staff', 'attendant']),
}));

export const fsSerializedOutboxContext = createFaker<SerializedOutboxContext>(() => ({
  correlationId: faker.string.uuid(),
  causationId: faker.string.uuid(),
  idempotencyKey: faker.string.uuid(),
  actorUserId: faker.string.uuid(),
  actorStoreId: faker.string.uuid(),
  actorRole: faker.helpers.arrayElement(['owner', 'manager', 'staff', 'attendant']),
  traceparent: faker.string.hexadecimal({ length: 55, prefix: '00-' }),
  tracestate: faker.string.hexadecimal({ length: 20 }),
}));
