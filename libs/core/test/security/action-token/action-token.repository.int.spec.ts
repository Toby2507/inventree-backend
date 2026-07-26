import {
  ACTION_TOKEN_PURPOSES,
  ACTION_TOKEN_REVOKE_REASONS,
} from '@app/core/security/action-token/domain/aggregates/action-token.types';
import { DuplicateTokenHashException } from '@app/core/security/action-token/infrastructure/exceptions/persistence.exception';
import { ActionTokenKyselyRepository } from '@app/core/security/action-token/infrastructure/persistence/action-token.kysely.repository';
import { type OperationalSchema, OptimisticConcurrencyControlException } from '@app/database';
import { Duration, Instant } from '@app/shared-kernel';
import { faker } from '@app/testing';
import { feActionToken } from '@app/testing/core/security/action-token';
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
      token.consume(token.purpose, now);
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
      token1?.consume(token1.purpose, now);
      token2?.consume(token2.purpose, now);
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

    it('should return null if token with hash does not exist', async () => {
      const foundToken = await repo.findByHash(db, faker.string.alphanumeric(44));
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
        createdAt: Instant.parse(dateString).plus(Duration.hours(1)),
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
      consumeToken.consume(purpose, Instant.parse(dateString));
      const revokeToken = feActionToken.generate({ userId, purpose });
      revokeToken.revoke(ACTION_TOKEN_REVOKE_REASONS.MANUAL, Instant.parse(dateString));
      const expireToken = feActionToken.generate({
        userId,
        purpose,
        createdAt: Instant.parse(dateString).minus(Duration.hours(1)),
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
        Instant.parse(dateString).plus(Duration.hours(1)),
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

  describe('findUsableByUser()', () => {
    it('should return all usable action tokens for a user regardless of purpose', async () => {
      const tokens = feActionToken.generateMany(2, { userId });
      await Promise.all(tokens.map((t) => repo.create(db, t)));
      const foundTokens = await repo.findUsableByUser(db, userId, Instant.parse(dateString));
      expect(foundTokens).toHaveLength(2);
    });

    it('should return an empty array if no usable token exists for a user', async () => {
      const foundTokens = await repo.findUsableByUser(db, userId, Instant.parse(dateString));
      expect(foundTokens).toHaveLength(0);
    });

    it('should return an empty array if the available tokens are not usable (consumed, revoked, or expired)', async () => {
      const token = feActionToken.generate({ userId });
      token.consume(token.purpose, Instant.parse(dateString));
      await repo.create(db, token);
      const foundTokens = await repo.findUsableByUser(db, userId, Instant.parse(dateString));
      expect(foundTokens).toHaveLength(0);
    });
  });

  describe('findById()', () => {
    it('should return action token by id', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      const foundToken = await repo.findById(db, token.id.value);
      expect(foundToken?.toSnapshot()).toEqual(token.toSnapshot());
    });

    it("should return null if token with given id doesn't exist", async () => {
      const foundToken = await repo.findById(db, faker.string.uuid());
      expect(foundToken).toBeNull();
    });
  });

  describe('revokeUsableByIds()', () => {
    it('should be no-op if ids array is empty', async () => {
      await expect(
        repo.revokeUsableByIds(
          db,
          [],
          ACTION_TOKEN_REVOKE_REASONS.MANUAL,
          Instant.parse(dateString),
        ),
      ).resolves.toBeUndefined();
    });

    it('should revoke all usable tokens by ids with the given reason', async () => {
      const tokens = feActionToken.generateMany(3, { userId });
      await Promise.all(tokens.map((t) => repo.create(db, t)));
      const tokenIds = tokens.map((t) => t.id.value);
      await repo.revokeUsableByIds(
        db,
        tokenIds,
        ACTION_TOKEN_REVOKE_REASONS.MANUAL,
        Instant.parse(dateString),
      );
      const foundTokens = await Promise.all(tokenIds.map((id) => repo.findById(db, id)));
      for (const token of foundTokens) {
        expect(token?.isRevoked()).toBe(true);
        expect(token?.toSnapshot().revokedReason).toBe(ACTION_TOKEN_REVOKE_REASONS.MANUAL);
      }
    });

    it('should be no-op if no usable tokens are found for the given ids', async () => {
      const tokens = feActionToken.generateMany(2, { userId });
      await Promise.all(tokens.map((t) => repo.create(db, t)));
      const tokenIds = tokens.map((t) => t.id.value);
      await repo.revokeUsableByIds(
        db,
        tokenIds,
        ACTION_TOKEN_REVOKE_REASONS.MANUAL,
        Instant.parse(dateString),
      );
      // Attempt to revoke again
      await expect(
        repo.revokeUsableByIds(
          db,
          tokenIds,
          ACTION_TOKEN_REVOKE_REASONS.MANUAL,
          Instant.parse(dateString).plus(Duration.hours(1)),
        ),
      ).resolves.toBeUndefined();
      const foundTokens = await Promise.all(tokenIds.map((id) => repo.findById(db, id)));
      for (const token of foundTokens) {
        expect(token?.isRevoked()).toBe(true);
        const snapshot = token?.toSnapshot();
        expect(snapshot?.revokedReason).toBe(ACTION_TOKEN_REVOKE_REASONS.MANUAL);
        expect(snapshot?.revokedAt?.equals(Instant.parse(dateString))).toBe(true);
      }
    });
  });

  describe('deleteExpired()', () => {
    it('should be no-op if limit is less than or equal to 0', async () => {
      await expect(repo.deleteExpired(db, Instant.parse(dateString), 0)).resolves.toBe(0);
      await expect(repo.deleteExpired(db, Instant.parse(dateString), -1)).resolves.toBe(0);
    });

    it('should delete expired tokens before the given time', async () => {
      const tokens = feActionToken.generateMany(5, (idx: number) => ({
        userId,
        createdAt: Instant.parse(dateString).minus(Duration.hours(idx + 1)),
        expiresAt: Instant.parse(dateString).minus(Duration.seconds(idx)),
      }));
      await Promise.all(tokens.map((t) => repo.create(db, t)));
      const deletedCount = await repo.deleteExpired(
        db,
        Instant.parse(dateString).plus(Duration.minutes(1)),
        10,
      );
      expect(deletedCount).toBe(5);
      const remainingTokens = await db.selectFrom('action_tokens').select('id').execute();
      expect(remainingTokens).toHaveLength(0);
    });

    it('should delete only up to the limit of expired tokens', async () => {
      const tokens = feActionToken.generateMany(5, (idx: number) => ({
        userId,
        createdAt: Instant.parse(dateString).minus(Duration.hours(idx + 1)),
        expiresAt: Instant.parse(dateString).minus(Duration.seconds(idx)),
      }));
      await Promise.all(tokens.map((t) => repo.create(db, t)));
      const deletedCount = await repo.deleteExpired(
        db,
        Instant.parse(dateString).plus(Duration.minutes(1)),
        3,
      );
      expect(deletedCount).toBe(3);
      const remainingTokens = await db.selectFrom('action_tokens').select('id').execute();
      expect(remainingTokens).toHaveLength(2);
    });
  });
});
