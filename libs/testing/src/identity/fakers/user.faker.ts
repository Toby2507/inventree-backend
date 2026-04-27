import { CreateUserProps, User, UserSnapshot } from '@app/domain/identity';
import { faker } from '@faker-js/faker';
import { createEntityFaker, createFaker } from '../../faker-factory';
import { fsUserSecurity } from './user-security.faker';

export const fsUser = createFaker<UserSnapshot>(() => ({
  id: faker.string.uuid(),
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
  security: fsUserSecurity.generate(),
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
