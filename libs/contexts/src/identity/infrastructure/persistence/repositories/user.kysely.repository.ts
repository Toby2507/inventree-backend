import { OperationalDB } from '@app/database';
import { Injectable } from '@nestjs/common';
import { User, UserRepository } from '../../../domain';
import { UserMapper } from '../mappers';

@Injectable()
export class UserKyselyRepository implements UserRepository {
  constructor(private readonly mapper: UserMapper) {}

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
    } catch (error) {
      throw error;
    }
  }
}
