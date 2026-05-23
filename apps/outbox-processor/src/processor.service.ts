import { AppLoggerService } from '@app/core';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

@Injectable()
export class OutboxProcessorService implements OnApplicationBootstrap {
  private readonly logger;

  constructor(private readonly appLogger: AppLoggerService) {
    this.logger = appLogger.forContext('OutboxProcessor');
  }

  onApplicationBootstrap(): void {
    this.startPolling();
  }

  private startPolling(): void {
    // Polling loop — simplified for brevity
    // setInterval(() => this.processBatch(), 5_000);
  }

  // private async processBatch(): Promise<void> {
  //   // Fetch pending rows, then for each row:
  //   const rows = await this.fetchPendingRows();

  //   for (const row of rows) {
  //     await this.processRow(row);
  //   }
  // }

  // private async processRow(row: OutboxRow): Promise<void> {
  //   const obs = (row.payload as any)._obs as SerializedBusinessContext | undefined;
  //   await withRestoredObservationContext(
  //     obs,
  //     {
  //       spanName: `outbox.process.${row.event_type}`,
  //       spanKind: SpanKind.CONSUMER,
  //       spanAttributes: {
  //         [SpanAttributes.OUTBOX_EVENT_TYPE]: row.event_type,
  //         [SpanAttributes.OUTBOX_AGGREGATE_TYPE]: row.aggregate_type ?? '',
  //         [SpanAttributes.AGGREGATE_ID]: row.aggregate_id ?? '',
  //       },
  //     },
  //     async () => {
  //       await this.dispatch(row);
  //       this.logger.log('Outbox event dispatched', { eventType: row.event_type });
  //     },
  //   );
  // }
}
