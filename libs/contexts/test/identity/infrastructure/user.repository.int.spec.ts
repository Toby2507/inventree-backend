import { UserKyselyRepository } from '@app/contexts';
import { OperationalSchema } from '@app/database';
import { createTestContext, faker, TestContext } from '@app/testing';

describe('UserKyselyRepository (integration)', () => {
  let ctx: TestContext<OperationalSchema>;
  let repo: UserKyselyRepository;

  beforeEach(async () => {
    ctx = await createTestContext();
    repo = new UserKyselyRepository();
  });

  afterEach(async () => {
    await ctx.rollback();
  });

  describe('UserKyselyRepository.existsByEmail()', () => {
    it('should return true if the email exists', async () => {
      const email = faker.internet.email();
      await ctx.db.insertInto('users').values({ email, password_hash: 'password123' }).execute();
      const exists = await repo.existsByEmail(ctx.db, email);
      expect(exists).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      const email = faker.internet.email();
      const exists = await repo.existsByEmail(ctx.db, email);
      expect(exists).toBe(false);
    });

    it('should ignore soft deleted users', async () => {
      const email = faker.internet.email();
      await ctx.db.insertInto('users').values({ email, password_hash: 'password123' }).execute();
      await ctx.db
        .updateTable('users')
        .set({ deleted_at: new Date() })
        .where('email', '=', email)
        .execute();
      const exists = await repo.existsByEmail(ctx.db, email);
      expect(exists).toBe(false);
    });
  });
});
