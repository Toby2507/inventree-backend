import { isUniqueViolation, type OperationalDB } from '@app/database';
import { Injectable } from '@nestjs/common';
import type { User } from '../../../domain/user/aggregates/user.aggregate';
import { UserEmailAlreadyExistsException } from '../../../domain/user/exceptions/registration.exceptions';
import type { UserRepository } from '../../../domain/user/ports/repositories/user.repository';
import { UserMapper } from '../mappers/user/user.mapper';

@Injectable()
export class UserKyselyRepository implements UserRepository {
  private readonly mapper = new UserMapper();

  async existsByEmail(db: OperationalDB, email: string): Promise<boolean> {
    const result = await db
      .selectNoFrom((eb) => [
        eb
          .exists(
            eb
              .selectFrom('users')
              .select('id')
              .where('email', '=', email)
              .where('deleted_at', 'is', null),
          )
          .as('exists'),
      ])
      .executeTakeFirst();
    return !!result?.exists;
  }

  async create(db: OperationalDB, user: User): Promise<void> {
    const { user: userData, security } = this.mapper.toPersistence(user);
    try {
      await db.insertInto('users').values(userData).execute();
      await db.insertInto('user_security').values(security).execute();
    } catch (error: any) {
      if (isUniqueViolation(error)) throw new UserEmailAlreadyExistsException(userData.email);
      throw error;
    }
  }
}
