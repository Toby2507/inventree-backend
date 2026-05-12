import { OperationalSchema } from '@app/database';
import { Insertable, Selectable } from 'kysely';

export type UserRow = Selectable<OperationalSchema['users']>;
export type UserSnapRow = Omit<UserRow, 'updated_at'>;
export type NewUserRow = Insertable<OperationalSchema['users']>;
export type UserSecurityRow = Selectable<OperationalSchema['user_security']>;
export type UserSecuritySnapRow = Omit<UserSecurityRow, 'created_at' | 'updated_at' | 'deleted_at'>;
export type NewUserSecurityRow = Insertable<OperationalSchema['user_security']>;

export interface UserPersistence {
  readonly user: UserSnapRow;
  readonly security: UserSecuritySnapRow;
}
