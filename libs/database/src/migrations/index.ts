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
import * as inventory_movements from './1773612100586_inventory_movements';
import * as inventory_items from './1773613455342_inventory_items';
import * as inventory_lots from './1773614468238_inventory_lots';
import * as inventory_lot_movements from './1773614944127_inventory_lot_movements';
import * as inventory_lot_items from './1773615484426_inventory_lot_items';
import * as inventory_serials from './1773616870341_inventory_serials';
import * as inventory_serial_movements from './1773617979656_inventory_serial_movements';
import * as inventory_stocktakes from './1773618669794_inventory_stocktakes';
import * as inventory_stocktake_lines from './1773620741202_inventory_stocktake_lines';
import * as inventory_transfers from './1773622434857_inventory_transfers';
import * as inventory_transfer_lines from './1773623744680_inventory_transfer_lines';
import * as inventory_adjustment_reasons from './1773657918602_inventory_adjustment_reasons';
import * as inventory_adjustments from './1773658491710_inventory_adjustments';
import * as inventory_adjustment_lines from './1773662385285_inventory_adjustment_lines';
import * as store_discounts from './1773667084340_store_discounts';
import * as store_discount_conditions from './1773667352676_store_discount_conditions';
import * as pos_terminals from './1773668945342_pos_terminals';
import * as pos_sessions from './1773669891590_pos_sessions';
import * as pos_transactions from './1773678347034_pos_transactions';
import * as pos_transaction_lines from './1773680571232_pos_transaction_lines';
import * as pos_payment_intents from './1773681843455_pos_payment_intents';
import * as store_suppliers from './1773692158987_store_suppliers';
import * as purchase_orders from './1773693143543_purchase_orders';
import * as purchase_order_lines from './1773694125849_purchase_order_lines';
import * as purchase_receipts from './1773696857464_purchase_receipts';
import * as purchase_receipt_lines from './1773697444507_purchase_receipt_lines';
import * as supplier_returns from './1773698108799_supplier_returns';
import * as supplier_return_lines from './1773739807416_supplier_return_lines';

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
  '1773612100586_inventory_movements': inventory_movements,
  '1773613455342_inventory_items': inventory_items,
  '1773614468238_inventory_lots': inventory_lots,
  '1773614944127_inventory_lot_movements': inventory_lot_movements,
  '1773615484426_inventory_lot_items': inventory_lot_items,
  '1773616870341_inventory_serials': inventory_serials,
  '1773617979656_inventory_serial_movements': inventory_serial_movements,
  '1773618669794_inventory_stocktakes': inventory_stocktakes,
  '1773620741202_inventory_stocktake_lines': inventory_stocktake_lines,
  '1773622434857_inventory_transfers': inventory_transfers,
  '1773623744680_inventory_transfer_lines': inventory_transfer_lines,
  '1773657918602_inventory_adjustment_reasons': inventory_adjustment_reasons,
  '1773658491710_inventory_adjustments': inventory_adjustments,
  '1773662385285_inventory_adjustment_lines': inventory_adjustment_lines,
  '1773667084340_store_discounts': store_discounts,
  '1773667352676_store_discount_conditions': store_discount_conditions,
  '1773668945342_pos_terminals': pos_terminals,
  '1773669891590_pos_sessions': pos_sessions,
  '1773678347034_pos_transactions': pos_transactions,
  '1773680571232_pos_transaction_lines': pos_transaction_lines,
  '1773681843455_pos_payment_intents': pos_payment_intents,
  '1773692158987_store_suppliers': store_suppliers,
  '1773693143543_purchase_orders': purchase_orders,
  '1773694125849_purchase_order_lines': purchase_order_lines,
  '1773696857464_purchase_receipts': purchase_receipts,
  '1773697444507_purchase_receipt_lines': purchase_receipt_lines,
  '1773698108799_supplier_returns': supplier_returns,
  '1773739807416_supplier_return_lines': supplier_return_lines,
};
