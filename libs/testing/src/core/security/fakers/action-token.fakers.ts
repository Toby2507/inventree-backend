import {
  ActionToken,
  ActionTokenSnapshot,
  CreateActionTokenProps,
} from '@app/core/security/action-token/domain/aggregates/action-token.aggregate';
import { ACTION_TOKEN_PURPOSE } from '@app/core/security/action-token/domain/aggregates/action-token.types';
import { ActionTokenRow } from '@app/core/security/action-token/infrastructure/persistence/action-token.persistence.types';
import { Instant } from '@app/shared-kernel';
import { faker } from '@app/testing';
import { createEntityFaker, createFaker } from '@app/testing/faker-factory';

export const fsActionToken = createFaker<ActionTokenSnapshot>(() => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  purpose: faker.helpers.arrayElement(Object.values(ACTION_TOKEN_PURPOSE)),
  tokenHash: faker.string.alphanumeric(64),
  createdAt: Instant.fromDate(faker.date.past()),
  expiresAt: Instant.fromDate(faker.date.future()),
  consumedAt: null,
  revokedAt: null,
  revokedReason: null,
  version: 1,
}));

export const fdActionToken = createFaker<ActionTokenRow>(() => ({
  id: faker.string.uuid(),
  user_id: faker.string.uuid(),
  purpose: faker.helpers.arrayElement(Object.values(ACTION_TOKEN_PURPOSE)),
  token_hash: faker.string.alphanumeric(64),
  created_at: faker.date.past(),
  expires_at: faker.date.future(),
  consumed_at: null,
  revoked_at: null,
  revoked_reason: null,
  version: 1,
}));

export const feActionToken = createEntityFaker<
  ActionToken,
  CreateActionTokenProps,
  ActionTokenSnapshot
>(
  ActionToken,
  () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    purpose: faker.helpers.arrayElement(Object.values(ACTION_TOKEN_PURPOSE)),
    tokenHash: faker.string.alphanumeric(64),
    createdAt: Instant.fromDate(faker.date.past()),
    expiresAt: Instant.fromDate(faker.date.future()),
  }),
  fsActionToken.generate,
);
