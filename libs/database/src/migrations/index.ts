import { Migration } from 'kysely';
import * as extensions_and_schemas from './1772871100254_extensions_and_schemas';
import * as users from './1772874126615_users';
import * as user_security from './1772875672384_user_security';
import * as businesses from './1772878475764_businesses';
import * as stores from './1772880658096_stores';
import * as store_members from './1772882903764_store_members';
import * as store_invitations from './1772884905872_store_invitations';

export const migrations: Record<string, Migration> = {
  '1772871100254_extensions_and_schemas': extensions_and_schemas,
  '1772874126615_users': users,
  '1772875672384_user_security': user_security,
  '1772878475764_businesses': businesses,
  '1772880658096_stores': stores,
  '1772882903764_store_members': store_members,
  '1772884905872_store_invitations': store_invitations,
};
