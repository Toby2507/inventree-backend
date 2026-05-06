import { User } from '../../aggregates';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
