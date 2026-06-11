import {
  CreateUserProps,
  User,
  UserSnapshot,
} from '@app/contexts/identity/domain/user/aggregates/user.aggregate';
import { UserSnapRow } from '@app/contexts/identity/infrastructure/persistence/mappers/user/user.persistence.types';
import { createEntityFaker, createFaker } from '@app/testing/faker-factory';
import { faker } from '@faker-js/faker';
import { fsUserSecurity } from './user-security.faker';

export const fsUser = createFaker<UserSnapshot>(() => {
  const userId = faker.string.uuid();
  return {
    id: userId,
    email: faker.internet.email(),
    emailVerifiedAt: null,
    phone: null,
    phoneVerifiedAt: null,
    firstName: null,
    lastName: null,
    displayName: null,
    status: 'pending',
    passwordHash: faker.string.alphanumeric(128),
    createdAt: faker.date.past(),
    deletedAt: null,
    security: fsUserSecurity.generate({ userId }),
  };
});

export const fdUser = createFaker<UserSnapRow>(() => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  email_verified_at: faker.date.past(),
  phone: faker.phone.number(),
  phone_verified_at: faker.date.past(),
  password_hash: faker.string.alphanumeric(128),
  first_name: faker.person.firstName(),
  last_name: faker.person.lastName(),
  display_name: faker.internet.displayName(),
  status: 'active',
  created_at: faker.date.past(),
  deleted_at: null,
}));

export const feUser = createEntityFaker<User, CreateUserProps, UserSnapshot>(
  User,
  () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    passwordHash: faker.string.alphanumeric(128),
  }),
  fsUser.generate,
);
