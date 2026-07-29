import type { OperationalDB } from '@app/database';
import type { User } from '../../aggregates/user.aggregate';

export interface UserRepository {
  existsByEmail(db: OperationalDB, email: string): Promise<boolean>;
  create(db: OperationalDB, user: User): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
