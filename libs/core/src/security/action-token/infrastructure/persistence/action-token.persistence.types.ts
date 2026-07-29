import type { OperationalSchema } from '@app/database';
import type { Insertable, Selectable } from 'kysely';

export type ActionTokenRow = Selectable<OperationalSchema['action_tokens']>;
export type NewActionTokenRow = Insertable<OperationalSchema['action_tokens']>;
