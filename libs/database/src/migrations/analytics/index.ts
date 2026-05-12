import { Migration } from 'kysely';
import * as fact_sales from './1774124176810_fact_sales';
import * as product_trend_snapshots from './1774125841794_product_trend_snapshots';
import * as inventory_recommendations from './1774172838057_inventory_recommendations';

export const analyticsMigrations: Record<string, Migration> = {
  '1774124176810_fact_sales': fact_sales,
  '1774125841794_product_trend_snapshots': product_trend_snapshots,
  '1774172838057_inventory_recommendations': inventory_recommendations,
};
