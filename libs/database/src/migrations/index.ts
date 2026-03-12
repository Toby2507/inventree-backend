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
import * as store_categories from './1773051884404_store_categories';
import * as store_uoms from './1773052705445_store_uoms';
import * as media_assets from './1773054251372_media_assets';
import * as barcode_registry from './1773075561273_barcode_registry';
import * as store_variant_groups from './1773082472904_store_variant_groups';
import * as store_variant_options from './1773082822024_store_variant_options';
import * as products from './1773083438011_products';
import * as product_variants from './1773143689984_product_variants';
import * as product_variant_option_assignments from './1773262438471_product_variant_option_assignments';
import * as product_uoms from './1773304595401_product_uoms';
import * as product_media from './1773335839126_product_media';

export const migrations: Record<string, Migration> = {
  '1772871100254_extensions_and_schemas': extensions_and_schemas,
  // IAM
  '1772874126615_users': users,
  '1772875672384_user_security': user_security,
  '1772878475764_businesses': businesses,
  '1772880658096_stores': stores,
  '1772882903764_store_members': store_members,
  '1772884905872_store_invitations': store_invitations,
  // Store Configs
  '1772898757433_store_settings': store_settings,
  '1772901312381_store_number_sequences': store_number_sequences,
  '1772919634410_store_receipt_settings': store_receipt_settings,
  '1772924305574_store_locations': store_locations,
  '1772973383056_tax_classes': tax_classes,
  '1772975074516_tax_rates': tax_rates,
  '1773006518323_tax_class_rates': tax_class_rates,
  '1773007571709_store_order_tax_rates': store_order_tax_rates,
  // Product Catalog
  '1773051884404_store_categories': store_categories,
  '1773052705445_store_uoms': store_uoms,
  '1773054251372_media_assets': media_assets,
  '1773075561273_barcode_registry': barcode_registry,
  '1773082472904_store_variant_groups': store_variant_groups,
  '1773082822024_store_variant_options': store_variant_options,
  '1773083438011_products': products,
  '1773143689984_product_variants': product_variants,
  '1773262438471_product_variant_option_assignments': product_variant_option_assignments,
  '1773304595401_product_uoms': product_uoms,
  '1773335839126_product_media': product_media,
};
