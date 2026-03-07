import { Migration } from 'kysely';
import * as extensions_and_schemas from './1772871100254_extensions_and_schemas';

export const migrations: Record<string, Migration> = {
  '1772871100254_extensions_and_schemas': extensions_and_schemas,
};
