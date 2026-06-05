import { UserEmailAlreadyExistsException } from '@app/contexts/identity/domain/user/exceptions/registration.exceptions';
import { UserKyselyRepository } from '@app/contexts/identity/infrastructure/persistence/repositories/user.kysely.repository';
import { OperationalSchema } from '@app/database';
import { feUser, fsUserSecurity } from '@app/testing/identity';
import { createTestContext, faker, TestContext } from '@app/testing/utils';
import { Kysely } from 'kysely';

describe('UserKyselyRepository (integration)', () => {
  let ctx: TestContext<OperationalSchema>;
  let db: Kysely<OperationalSchema>;
  let repo: UserKyselyRepository;

  beforeAll(async () => {
    ctx = await createTestContext();
    repo = new UserKyselyRepository();
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

  describe('UserKyselyRepository.existsByEmail()', () => {
    it('should return true if the email exists', async () => {
      const email = faker.internet.email();
      await db.insertInto('users').values({ email, password_hash: 'password123' }).execute();
      const exists = await repo.existsByEmail(db, email);
      expect(exists).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      const email = faker.internet.email();
      const exists = await repo.existsByEmail(db, email);
      expect(exists).toBe(false);
    });

    it('should ignore soft deleted users', async () => {
      const email = faker.internet.email();
      await db.insertInto('users').values({ email, password_hash: 'password123' }).execute();
      await db
        .updateTable('users')
        .set({ deleted_at: new Date() })
        .where('email', '=', email)
        .execute();
      const exists = await repo.existsByEmail(db, email);
      expect(exists).toBe(false);
    });
  });

  describe('UserKyselyRepository.create()', () => {
    it('should persist user and security data correctly', async () => {
      const user = feUser.generate({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      });
      await repo.create(db, user);
      const dbUser = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', user.email.value)
        .executeTakeFirst();
      const dbSecurity = await db
        .selectFrom('user_security')
        .selectAll()
        .where('user_id', '=', user.id.value)
        .executeTakeFirst();
      expect(dbUser).toMatchObject({
        id: user.id.value,
        email: user.email.value,
        first_name: user.firstName?.value,
        last_name: user.lastName?.value,
      });
      expect(dbSecurity).toMatchObject({
        user_id: user.id.value,
      });
    });

    it('should throw UserEmailAlreadyExistsException for duplicate email', async () => {
      const email = faker.internet.email();
      await db.insertInto('users').values({ email, password_hash: 'password123' }).execute();
      const user = feUser.generate({ email });
      await expect(repo.create(db, user)).rejects.toThrow(UserEmailAlreadyExistsException);
    });

    it('should not create partial user when security insert fails', async () => {
      const invalidSecurity = fsUserSecurity.generate({ userId: null as any });
      const user = feUser.generateFromSnapshot({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        security: invalidSecurity,
      });
      await expect(repo.create(db, user)).rejects.toThrow(/null value/i);
      // start fresh transaction after aborted trx
      db = await ctx.begin();
      const dbUser = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', user.email.value)
        .executeTakeFirst();
      expect(dbUser).toBeUndefined();
    });
  });
});
