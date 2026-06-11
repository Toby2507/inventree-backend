import { StoreContext } from '@app/database';
import { createFaker } from '@app/testing/faker-factory';
import { faker } from '@faker-js/faker';

export const fsStoreContext = createFaker<StoreContext>(() => ({
  storeId: faker.string.uuid(),
  businessId: faker.string.uuid(),
  userId: faker.string.uuid(),
  storeMemberId: faker.string.uuid(),
  role: faker.helpers.arrayElement(['owner', 'manager', 'staff']),
}));

export const fsJwtPayload = createFaker(() => ({
  sub: faker.string.uuid(),
  storeId: faker.string.uuid(),
  businessId: faker.string.uuid(),
  storeMemberId: faker.string.uuid(),
  role: faker.helpers.arrayElement(['owner', 'manager', 'staff']),
}));
