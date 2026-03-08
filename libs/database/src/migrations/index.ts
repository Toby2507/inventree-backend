import { Migration } from 'kysely';
import * as extensions_and_schemas from './1772871100254_extensions_and_schemas';
import * as users from './1772874126615_users';
import * as user_security from './1772875672384_user_security';
import * as businesses from './1772878475764_businesses';
import * as stores from './1772880658096_stores';
import * as store_members from './1772882903764_store_members';
import * as store_invitations from './1772884905872_store_invitations';
import * as store_settings from './1772898757433_store_settings';
import * as store_number_sequences from './1772901312381_store_number_sequences';
import * as store_receipt_settings from './1772919634410_store_receipt_settings';
import * as store_locations from './1772924305574_store_locations';
import * as tax_classes from './1772973383056_tax_classes';
import * as tax_rates from './1772975074516_tax_rates';
import * as tax_class_rates from './1773006518323_tax_class_rates';
import * as store_order_tax_rates from './1773007571709_store_order_tax_rates';

export const migrations: Record<string, Migration> = {
  '1772871100254_extensions_and_schemas': extensions_and_schemas,
  '1772874126615_users': users,
  '1772875672384_user_security': user_security,
  '1772878475764_businesses': businesses,
  '1772880658096_stores': stores,
  '1772882903764_store_members': store_members,
  '1772884905872_store_invitations': store_invitations,
  '1772898757433_store_settings': store_settings,
  '1772901312381_store_number_sequences': store_number_sequences,
  '1772919634410_store_receipt_settings': store_receipt_settings,
  '1772924305574_store_locations': store_locations,
  '1772973383056_tax_classes': tax_classes,
  '1772975074516_tax_rates': tax_rates,
  '1773006518323_tax_class_rates': tax_class_rates,
  '1773007571709_store_order_tax_rates': store_order_tax_rates,
};
