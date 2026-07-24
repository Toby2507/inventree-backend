import {
  ACTION_TOKEN_PURPOSE,
  ACTION_TOKEN_REVOKE_REASON,
} from '@app/core/security/action-token/domain/action-token.types';
import { DuplicateTokenHashException } from '@app/core/security/action-token/infrastructure/action-token.exception';
import { ActionTokenKyselyRepository } from '@app/core/security/action-token/infrastructure/action-token.kysely.repository';
import { OperationalSchema, OptimisticConcurrencyControlException } from '@app/database';
import { Duration, Instant } from '@app/shared-kernel';
import { faker } from '@app/testing';
import { feActionToken } from '@app/testing/core/security';
import { createTestContext, TestContext } from '@app/testing/database';
import { Kysely } from 'kysely';

const dateString = '2024-01-01T00:00:00Z';

describe('ActionTokenKyselyRepository (integration)', () => {
  let ctx: TestContext<OperationalSchema>;
  let db: Kysely<OperationalSchema>;
  let repo: ActionTokenKyselyRepository;

  const createUser = async () => {
    const user = await db
      .insertInto('users')
      .values({ email: faker.internet.email(), password_hash: 'password123' })
      .returning('id')
      .executeTakeFirstOrThrow();
    return user.id;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    repo = new ActionTokenKyselyRepository();
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
    let userId: string;
    beforeEach(async () => {
      userId = await createUser();
    });

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
    let userId: string;
    const now = Instant.parse(dateString);

    beforeEach(async () => {
      userId = await createUser();
    });

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
    let userId: string;
    beforeEach(async () => {
      userId = await createUser();
    });

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

  describe('findActiveByUserAndPurpose()', () => {
    let userId: string;
    beforeEach(async () => {
      userId = await createUser();
    });

    it('should return active action token by user and purpose', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      const foundToken = await repo.findActiveByUserAndPurpose(
        db,
        userId,
        token.purpose,
        Instant.parse(dateString),
      );
      expect(foundToken?.toSnapshot()).toEqual(token.toSnapshot());
    });

    it('should return the most recent active token if multiple exist for user and purpose', async () => {
      const token1 = feActionToken.generate({
        userId,
        purpose: ACTION_TOKEN_PURPOSE.PASSWORD_RESET,
        createdAt: Instant.parse(dateString),
      });
      const token2 = feActionToken.generate({
        userId,
        purpose: ACTION_TOKEN_PURPOSE.PASSWORD_RESET,
        createdAt: Instant.parse(dateString).add(Duration.hours(1)),
      });
      await Promise.all([repo.create(db, token1), repo.create(db, token2)]);
      const foundToken = await repo.findActiveByUserAndPurpose(
        db,
        userId,
        ACTION_TOKEN_PURPOSE.PASSWORD_RESET,
        Instant.parse(dateString),
      );
      expect(foundToken?.toSnapshot()).toEqual(token2.toSnapshot());
    });

    it('should return null if no active token exists for user and purpose', async () => {
      const foundToken = await repo.findActiveByUserAndPurpose(
        db,
        userId,
        ACTION_TOKEN_PURPOSE.EMAIL_CHANGE,
        Instant.parse(dateString),
      );
      expect(foundToken).toBeNull();
    });

    it('should return null if token is consumed', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      token.consume(Instant.parse(dateString));
      await repo.update(db, token);
      const foundToken = await repo.findActiveByUserAndPurpose(
        db,
        userId,
        token.purpose,
        Instant.parse(dateString),
      );
      expect(foundToken).toBeNull();
    });

    it('should return null if token is revoked', async () => {
      const token = feActionToken.generate({ userId });
      await repo.create(db, token);
      token.revoke(ACTION_TOKEN_REVOKE_REASON.ATTEMPTS_EXCEEDED, Instant.parse(dateString));
      await repo.update(db, token);
      const foundToken = await repo.findActiveByUserAndPurpose(
        db,
        userId,
        token.purpose,
        Instant.parse(dateString),
      );
      expect(foundToken).toBeNull();
    });

    it('should return null if token is expired', async () => {
      const token = feActionToken.generate({
        userId,
        createdAt: Instant.parse(dateString).subtract(Duration.hours(1)),
        expiresAt: Instant.parse(dateString),
      });
      await repo.create(db, token);
      const foundToken = await repo.findActiveByUserAndPurpose(
        db,
        userId,
        token.purpose,
        Instant.parse(dateString).add(Duration.hours(1)),
      );
      expect(foundToken).toBeNull();
    });
  });
});
