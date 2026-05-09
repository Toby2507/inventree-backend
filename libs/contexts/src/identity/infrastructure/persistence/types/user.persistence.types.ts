import { OperationalSchema } from '@app/database';
import { Insertable, Selectable } from 'kysely';

export type UserRow = Selectable<OperationalSchema['users']>;
export type NewUserRow = Insertable<OperationalSchema['users']>;
export type UserSecurityRow = Selectable<OperationalSchema['user_security']>;
export type NewUserSecurityRow = Insertable<OperationalSchema['user_security']>;
export interface UserPersistence {
  user: Omit<UserRow, 'updated_at'>;
  security: Omit<UserSecurityRow, 'updated_at' | 'created_at' | 'deleted_at'>;
}
