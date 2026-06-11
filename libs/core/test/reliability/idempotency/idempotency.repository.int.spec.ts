import { IdempotencyKyselyRepository } from '@app/core/reliability/idempotency/persistence/idempotency.kysely.repository';
import { CreateIdempotency } from '@app/core/reliability/idempotency/persistence/idempotency.persistence.types';
import { OperationalDB, OperationalSchema } from '@app/database';
import { fsCreateIdempotencyInput } from '@app/testing/core/reliability/idempotency';
import { createTestContext, TestContext } from '@app/testing/database';

describe('IdempotencyKyselyRepository (integration)', () => {
  let ctx: TestContext<OperationalSchema>;
  let db: OperationalDB;
  let repo: IdempotencyKyselyRepository;

  const expireRecord = async (input: CreateIdempotency) => {
    return db
      .updateTable('idempotency')
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where('idempotency_key', '=', input.key)
      .where('scope', '=', input.scope)
      .execute();
  };
  const getRecord = async (input: CreateIdempotency) => {
    return db
      .selectFrom('idempotency')
      .selectAll()
      .where('idempotency_key', '=', input.key)
      .where('scope', '=', input.scope)
      .executeTakeFirst();
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    repo = new IdempotencyKyselyRepository();
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

  describe('IdempotencyKyselyRepository.tryClaim()', () => {
    it('should persist a new idempotency record correctly', async () => {
      const input = fsCreateIdempotencyInput.generate();
      const claimed = await repo.tryClaim(db, input);
      expect(claimed).toBe(true);
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeDefined();
      expect(dbRecord).toMatchObject({
        idempotency_key: input.key,
        scope: input.scope,
        request_hash: input.hash,
        status: 'in_progress',
      });
    });

    it('should do nothing on conflict with the same key and scope', async () => {
      const input = fsCreateIdempotencyInput.generate();
      const firstClaimed = await repo.tryClaim(db, input);
      expect(firstClaimed).toBe(true);
      const secondClaimed = await repo.tryClaim(db, input);
      expect(secondClaimed).toBe(false);
      const records = await db
        .selectFrom('idempotency')
        .selectAll()
        .where('idempotency_key', '=', input.key)
        .where('scope', '=', input.scope)
        .execute();
      expect(records).toHaveLength(1);
    });

    it('should set expires_at approximately ttl seconds from now', async () => {
      const input = fsCreateIdempotencyInput.generate();
      // Subtract 1s to absorb clock skew between the Node process and Postgres
      const before = new Date(Date.now() - 1000);
      const claimed = await repo.tryClaim(db, input);
      const after = new Date();
      expect(claimed).toBe(true);
      const dbRecord = await getRecord(input);
      const { expires_at } = dbRecord!;
      const expectedMin = new Date(before.getTime() + input.ttl * 1000);
      const expectedMax = new Date(after.getTime() + input.ttl * 1000);
      expect(expires_at.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(expires_at.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });
  });

  describe('IdempotencyKyselyRepository.findActiveRecord()', () => {
    let input: CreateIdempotency;

    beforeEach(async () => {
      input = fsCreateIdempotencyInput.generate();
      await repo.tryClaim(db, input);
    });

    it('should return record if it exists', async () => {
      const record = await repo.findActiveRecord(db, input.key, input.scope);
      expect(record).toBeDefined();
      expect(record).toMatchObject({
        idempotencyKey: input.key,
        requestHash: input.hash,
        scope: input.scope,
        status: 'in_progress',
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date),
        resolvedAt: null,
      });
    });

    it('should return null if no record exists', async () => {
      const [recordWrongKey, recordWrongScope] = await Promise.all([
        repo.findActiveRecord(db, 'nonexistent-key', input.scope),
        repo.findActiveRecord(db, input.key, 'nonexistent-scope'),
      ]);
      expect(recordWrongKey).toBeNull();
      expect(recordWrongScope).toBeNull();
    });

    it('should return null if record exists but is expired', async () => {
      await expireRecord(input);
      const record = await repo.findActiveRecord(db, input.key, input.scope);
      expect(record).toBeNull();
    });
  });

  describe('IdempotencyKyselyRepository.markCompleted()', () => {
    let input: CreateIdempotency;

    beforeEach(async () => {
      input = fsCreateIdempotencyInput.generate();
      await repo.tryClaim(db, input);
    });

    it('should mark record as completed with response and resolved_at', async () => {
      const response = { success: true };
      const result = await repo.markCompleted(db, input.key, input.scope, response);
      expect(result).toBeDefined();
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeDefined();
      expect(dbRecord).toMatchObject({
        idempotency_key: input.key,
        scope: input.scope,
        request_hash: input.hash,
        status: 'completed',
        response,
      });
      expect(dbRecord?.resolved_at).toBeInstanceOf(Date);
    });

    it('should not mark record as completed if it is already expired', async () => {
      await expireRecord(input);
      const response = { success: true };
      const result = await repo.markCompleted(db, input.key, input.scope, response);
      expect(result).toBeNull();
      const dbRecord = await getRecord(input);
      expect(dbRecord?.response).toBeNull();
      expect(dbRecord?.status).toBe('in_progress');
      expect(dbRecord?.resolved_at).toBeNull();
    });

    it('should not mark record as completed if it is already failed', async () => {
      await db
        .updateTable('idempotency')
        .set({ status: 'failed', error: { message: 'error' }, resolved_at: new Date() })
        .where('idempotency_key', '=', input.key)
        .where('scope', '=', input.scope)
        .execute();
      const response = { success: true };
      const result = await repo.markCompleted(db, input.key, input.scope, response);
      expect(result).toBeNull();
      const dbRecord = await getRecord(input);
      expect(dbRecord?.response).toBeNull();
      expect(dbRecord?.status).toBe('failed');
    });
  });

  describe('IdempotencyKyselyRepository.markFailed()', () => {
    let input: CreateIdempotency;

    beforeEach(async () => {
      input = fsCreateIdempotencyInput.generate();
      await repo.tryClaim(db, input);
    });

    it('should mark record as failed with error and resolved_at', async () => {
      const error = { message: 'Something went wrong' };
      const result = await repo.markFailed(db, input.key, input.scope, error);
      expect(result).toBeDefined();
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeDefined();
      expect(dbRecord).toMatchObject({
        idempotency_key: input.key,
        scope: input.scope,
        request_hash: input.hash,
        status: 'failed',
        error,
      });
      expect(dbRecord?.resolved_at).toBeInstanceOf(Date);
    });

    it('should not mark record as failed if it is already expired', async () => {
      await expireRecord(input);
      const error = { message: 'Something went wrong' };
      const result = await repo.markFailed(db, input.key, input.scope, error);
      expect(result).toBeNull();
      const dbRecord = await getRecord(input);
      expect(dbRecord?.error).toBeNull();
      expect(dbRecord?.status).toBe('in_progress');
      expect(dbRecord?.resolved_at).toBeNull();
    });

    it('should not mark record as failed if it is already completed', async () => {
      await db
        .updateTable('idempotency')
        .set({ status: 'completed', response: { success: true }, resolved_at: new Date() })
        .where('idempotency_key', '=', input.key)
        .where('scope', '=', input.scope)
        .execute();
      const error = { message: 'Something went wrong' };
      const result = await repo.markFailed(db, input.key, input.scope, error);
      expect(result).toBeNull();
      const dbRecord = await getRecord(input);
      expect(dbRecord?.error).toBeNull();
      expect(dbRecord?.status).toBe('completed');
    });
  });

  describe('IdempotencyKyselyRepository.deleteRecord()', () => {
    it('should delete the record with the given key and scope', async () => {
      const input = fsCreateIdempotencyInput.generate();
      await repo.tryClaim(db, input);
      await repo.deleteRecord(db, input.key, input.scope);
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeUndefined();
    });

    it('should do nothing if no record exists with the given key and scope', async () => {
      const input = fsCreateIdempotencyInput.generate();
      await repo.deleteRecord(db, input.key, input.scope);
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeUndefined();
    });
  });

  describe('IdempotencyKyselyRepository.deleteExpired()', () => {
    it('should delete all expired records', async () => {
      const expiredInput = fsCreateIdempotencyInput.generate();
      const activeInput = fsCreateIdempotencyInput.generate();
      await Promise.all([repo.tryClaim(db, expiredInput), repo.tryClaim(db, activeInput)]);
      await expireRecord(expiredInput);
      await repo.deleteExpired(db);
      const expiredRecord = await getRecord(expiredInput);
      const activeRecord = await getRecord(activeInput);
      expect(expiredRecord).toBeUndefined();
      expect(activeRecord).toBeDefined();
    });
  });

  describe('IdempotencyKyselyRepository.sweepStaleInProgress()', () => {
    let input: CreateIdempotency;

    const setRecordCreation = (date: Date) => {
      return db
        .updateTable('idempotency')
        .set({ created_at: date })
        .where('idempotency_key', '=', input.key)
        .where('scope', '=', input.scope)
        .execute();
    };

    beforeEach(async () => {
      input = fsCreateIdempotencyInput.generate();
      await repo.tryClaim(db, input);
    });

    it('should mark in_progress records that are older than threshold as failed', async () => {
      await setRecordCreation(new Date(Date.now() - 10 * 60 * 1000));
      await repo.sweepStaleInProgress(db, 5);
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.status).toBe('failed');
      expect(dbRecord?.error).toMatchObject({ message: 'Request timed out' });
      expect(dbRecord?.resolved_at).toBeInstanceOf(Date);
    });

    it('should mark in_progress records that are older than threshold and expired as failed', async () => {
      await db
        .updateTable('idempotency')
        .set({
          created_at: new Date(Date.now() - 10 * 60 * 1000),
          expires_at: new Date(Date.now() - 1000),
        })
        .where('idempotency_key', '=', input.key)
        .where('scope', '=', input.scope)
        .execute();
      await repo.sweepStaleInProgress(db, 5);
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.status).toBe('failed');
      expect(dbRecord?.error).toMatchObject({ message: 'Request timed out' });
      expect(dbRecord?.resolved_at).toBeInstanceOf(Date);
    });

    it('should not mark in_progress records that are newer than threshold as failed', async () => {
      await setRecordCreation(new Date(Date.now() - 2 * 60 * 1000));
      await repo.sweepStaleInProgress(db, 5);
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.status).toBe('in_progress');
      expect(dbRecord?.error).toBeNull();
      expect(dbRecord?.resolved_at).toBeNull();
    });

    it('should not process non in_progress records that are older than threshold', async () => {
      await setRecordCreation(new Date(Date.now() - 10 * 60 * 1000));
      await repo.markCompleted(db, input.key, input.scope, { success: true });
      await repo.sweepStaleInProgress(db, 5);
      const dbRecord = await getRecord(input);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.status).toBe('completed');
    });
  });
});
