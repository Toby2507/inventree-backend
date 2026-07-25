import {
  ACTION_TOKEN_PURPOSES,
  ACTION_TOKEN_REVOKE_REASONS,
} from '@app/core/security/action-token/domain/aggregates/action-token.types';
import { DuplicateTokenHashException } from '@app/core/security/action-token/infrastructure/exceptions/persistence.exception';
import { ActionTokenKyselyRepository } from '@app/core/security/action-token/infrastructure/persistence/action-token.kysely.repository';
import { type OperationalSchema, OptimisticConcurrencyControlException } from '@app/database';
import { Duration, Instant } from '@app/shared-kernel';
import { faker } from '@app/testing';
import { feActionToken } from '@app/testing/core/security';
import { createTestContext, type TestContext } from '@app/testing/database';
import type { Kysely } from 'kysely';

const dateString = '2024-01-01T00:00:00Z';

describe('ActionTokenKyselyRepository (integration)', () => {
  let ctx: TestContext<OperationalSchema>;
  let db: Kysely<OperationalSchema>;
  let repo: ActionTokenKyselyRepository;
  let userId: string;

  const createUser = async (db: Kysely<OperationalSchema>) => {
    const user = await db
      .insertInto('users')
      .values({ email: faker.internet.email(), password_hash: 'password123' })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = user.id;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    repo = new ActionTokenKyselyRepository();
    await ctx.run(createUser);
  });
  beforeEach(async () => {
    db = await ctx.begin();
  });
  afterEach(async () => {
    await ctx.rollback();
  });
  afterAll(async () => {
    await ctx.dispose();
  });

  describe('create()', () => {
    it('should persist action token correctly', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      const row = await db
        .selectFrom('action_tokens')
        .selectAll()
        .where('id', '=', token.id.value)
        .executeTakeFirst();
      expect(row).toMatchObject({
        id: token.id.value,
        user_id: token.userId,
        purpose: token.purpose,
        token_hash: token.tokenHash,
        expires_at: token.expiresAt.toDate(),
      });
    });

    it('should throw if generated token hash already exists', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      const duplicateToken = feActionToken.generate({
        userId,
        tokenHash: token.tokenHash,
      });
      await expect(repo.create(db, duplicateToken)).rejects.toThrow(DuplicateTokenHashException);
    });
  });

  describe('update()', () => {
    const now = Instant.parse(dateString);

    it('should update action token correctly', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      token.consume(now);
      await repo.update(db, token);
      const row = await db
        .selectFrom('action_tokens')
        .selectAll()
        .where('id', '=', token.id.value)
        .executeTakeFirst();
      expect(row).toMatchObject({
        id: token.id.value,
        consumed_at: token.toSnapshot().consumedAt?.toDate(),
        version: token.version,
      });
    });

    it('should throw if token version is outdated via optimistic concurrency control', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      const [token1, token2] = await Promise.all([
        repo.findByHash(db, token.tokenHash),
        repo.findByHash(db, token.tokenHash),
      ]);
      token1?.consume(now);
      token2?.consume(now);
      await repo.update(db, token1!);
      await expect(repo.update(db, token2!)).rejects.toThrow(OptimisticConcurrencyControlException);
    });
  });

  describe('findByHash()', () => {
    it('should return action token by hash', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      const foundToken = await repo.findByHash(db, token.tokenHash);
      expect(foundToken?.toSnapshot()).toEqual(token.toSnapshot());
    });

    it('should return null if token hash does not exist', async () => {
      const foundToken = await repo.findByHash(db, faker.string.uuid());
      expect(foundToken).toBeNull();
    });
  });

  describe('findUsableByUserAndPurpose()', () => {
    it('should return usable action token by user and purpose', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      const foundTokens = await repo.findUsableByUserAndPurpose(
        db,
        userId,
        token.purpose,
        Instant.parse(dateString),
      );
      expect(foundTokens).toHaveLength(1);
      expect(foundTokens[0]?.toSnapshot()).toEqual(token.toSnapshot());
    });

    it('should return all usable tokens if multiple exist for user and purpose', async () => {
      const token1 = feActionToken.generate({
        userId,
        purpose: ACTION_TOKEN_PURPOSES.PASSWORD_RESET,
        createdAt: Instant.parse(dateString),
      });
      const token2 = feActionToken.generate({
        userId,
        purpose: ACTION_TOKEN_PURPOSES.PASSWORD_RESET,
        createdAt: Instant.parse(dateString).add(Duration.hours(1)),
      });
      await Promise.all([repo.create(db, token1), repo.create(db, token2)]);
      const foundTokens = await repo.findUsableByUserAndPurpose(
        db,
        userId,
        ACTION_TOKEN_PURPOSES.PASSWORD_RESET,
        Instant.parse(dateString),
      );
      expect(foundTokens).toHaveLength(2);
    });

    it('should return an empty array if no usable token exists for user and purpose', async () => {
      const foundTokens = await repo.findUsableByUserAndPurpose(
        db,
        userId,
        ACTION_TOKEN_PURPOSES.EMAIL_CHANGE,
        Instant.parse(dateString),
      );
      expect(foundTokens).toHaveLength(0);
    });

    it('should return an empty array if the available tokens are not usable (consumed, revoked, or expired)', async () => {
      const purpose = ACTION_TOKEN_PURPOSES.PASSWORD_RESET;
      const consumeToken = feActionToken.generate({ userId, purpose });
      consumeToken.consume(Instant.parse(dateString));
      const revokeToken = feActionToken.generate({ userId, purpose });
      revokeToken.revoke(ACTION_TOKEN_REVOKE_REASONS.MANUAL, Instant.parse(dateString));
      const expireToken = feActionToken.generate({
        userId,
        purpose,
        createdAt: Instant.parse(dateString).subtract(Duration.hours(1)),
        expiresAt: Instant.parse(dateString),
      });
      await Promise.all([
        repo.create(db, consumeToken),
        repo.create(db, revokeToken),
        repo.create(db, expireToken),
      ]);
      const foundTokens = await repo.findUsableByUserAndPurpose(
        db,
        userId,
        purpose,
        Instant.parse(dateString).add(Duration.hours(1)),
      );
      expect(foundTokens).toHaveLength(0);
    });

    it('should return an empty array if the available tokens are for a different purpose', async () => {
      const purpose = ACTION_TOKEN_PURPOSES.PASSWORD_RESET;
      const token = feActionToken.generate({ userId, purpose });
      await repo.create(db, token);
      const foundTokens = await repo.findUsableByUserAndPurpose(
        db,
        userId,
        ACTION_TOKEN_PURPOSES.EMAIL_CHANGE,
        Instant.parse(dateString),
      );
      expect(foundTokens).toHaveLength(0);
    });
  });
});
