import { StoreContext } from '@app/database';
import { faker } from '@faker-js/faker';
import { createFaker } from '../../faker-factory';

export const storeContextFaker = createFaker<StoreContext>(() => ({
  storeId: faker.string.uuid(),
  businessId: faker.string.uuid(),
  userId: faker.string.uuid(),
  storeMemberId: faker.string.uuid(),
  role: faker.helpers.arrayElement(['owner', 'manager', 'staff']),
}));

export const jwtPayloadFaker = createFaker(() => ({
  sub: faker.string.uuid(),
  storeId: faker.string.uuid(),
  businessId: faker.string.uuid(),
  storeMemberId: faker.string.uuid(),
  role: faker.helpers.arrayElement(['owner', 'manager', 'staff']),
}));
