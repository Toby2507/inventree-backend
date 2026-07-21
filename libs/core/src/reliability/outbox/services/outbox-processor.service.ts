import { ID_GENERATOR, IDGeneratorPort } from '@app/core/generators';
import {
  getOptionalObservationContext,
  LOGGER,
  LoggerPort,
  SerializedBusinessContext,
  SpanAttributes,
  withRestoredObservationContext,
} from '@app/core/observability';
import {
  DATABASE_CONTEXT,
  DATABASE_LISTENER,
  DatabaseContextPort,
  DatabaseListenerPort,
  ListenChannel,
} from '@app/database';
import { JsonValue } from '@app/shared-kernel';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SpanKind } from '@opentelemetry/api';
import pLimit from 'p-limit';
import { EVENT_ROUTER, EventRouterPort } from '../ports/event-router.port';
import { QUEUE_MAPPER, QueueMapperPort } from '../ports/queue-mapper.port';
import { OUTBOX_REPOSITORY, OutboxRepository } from '../ports/repository.port';
import { OutboxEvent } from '../types/outbox.interface';

@Injectable()
export class OutboxProcessorService implements OnApplicationBootstrap {
  private readonly BATCH_SIZE = 25;
  private readonly LOCK_DURATION_MS = 30_000;
  private readonly MAX_PUBLISH_ATTEMPTS = 5;
  private readonly BASE_BACKOFF_MS = 5_000;
  private readonly MAX_BACKOFF_MS = 5 * 60 * 1_000;
  private readonly CONCURRENCY_LIMIT = 5;

  private readonly instanceId: string;
  private readonly logger;
  private isProcessing = false;
  private needsAnotherPass = false;

  constructor(
    @Inject(LOGGER) logger: LoggerPort,
    @Inject(DATABASE_CONTEXT) private readonly db: DatabaseContextPort,
    @Inject(ID_GENERATOR) private readonly idGenerator: IDGeneratorPort,
    @Inject(EVENT_ROUTER) private readonly eventRouter: EventRouterPort,
    @Inject(QUEUE_MAPPER) private readonly queueMapper: QueueMapperPort,
    @Inject(OUTBOX_REPOSITORY) private readonly repository: OutboxRepository,
    @Inject(DATABASE_LISTENER) private readonly listener: DatabaseListenerPort,
  ) {
    this.instanceId = this.idGenerator.generateUUIDV4();
    this.logger = logger.forContext(OutboxProcessorService.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Outbox processor started', { instanceId: this.instanceId });
    this.listener.subscribe(
      ListenChannel.OUTBOX_PENDING,
      OutboxProcessorService.name,
      () => void this.triggerProcessing(),
    );
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async retryDueEvents(): Promise<void> {
    await this.triggerProcessing();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredLocks(): Promise<void> {
    const count = await this.db.platformCommand((ctx) =>
      this.repository.releaseExpiredLocks(ctx.operational),
    );
    if (count > 0)
      this.logger.warn('Released expired outbox locks', {
        count,
        instanceId: this.instanceId,
      });
  }

  private async triggerProcessing(): Promise<void> {
    if (this.isProcessing) {
      this.needsAnotherPass = true;
      return;
    }
    this.isProcessing = true;
    try {
      do {
        this.needsAnotherPass = false;
        await this.drain();
      } while (this.needsAnotherPass);
    } finally {
      this.isProcessing = false;
    }
  }

  private async drain(): Promise<void> {
    while (true) {
      const rowCount = await this.processBatch();
      if (rowCount === 0) break;
    }
  }

  private async processBatch(): Promise<number> {
    try {
      const rows = await this.db.platformCommand((ctx) =>
        this.repository.claimBatch(
          ctx.operational,
          this.BATCH_SIZE,
          this.instanceId,
          this.LOCK_DURATION_MS,
        ),
      );
      if (!rows.length) return 0;
      this.logger.debug('Claimed outbox batch', {
        count: rows.length,
        instanceId: this.instanceId,
      });
      const limit = pLimit(this.CONCURRENCY_LIMIT);
      const results = await Promise.allSettled(
        rows.map((row) => limit(() => this.processRow(row))),
      );
      const unexpected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (unexpected.length) {
        this.logger.error('Unexpected processRow rejections in batch', {
          count: unexpected.length,
          reasons: unexpected.map((r) => r.reason?.message ?? String(r.reason)),
        });
      }
      return rows.length;
    } catch (error) {
      this.logger.error('Failed to process outbox batch', {
        error: error instanceof Error ? error.stack : String(error),
      });
      return 0;
    }
  }

  private async processRow(row: OutboxEvent): Promise<void> {
    const payload = (row.payload as any).data as JsonValue;
    const obs = (row.payload as any)._obs as SerializedBusinessContext | undefined;
    return withRestoredObservationContext(
      obs,
      {
        spanName: `outbox.process.${row.eventType}`,
        spanKind: SpanKind.PRODUCER,
        spanAttributes: {
          [SpanAttributes.OUTBOX_EVENT_TYPE]: row.eventType,
          [SpanAttributes.OUTBOX_AGGREGATE_TYPE]: row.aggregateType ?? '',
          [SpanAttributes.AGGREGATE_ID]: row.aggregateId ?? '',
        },
      },
      async () => {
        try {
          const routes = this.eventRouter.resolve(row.eventType);
          if (!routes.length) {
            this.logger.log('No route configured for event - marking handled', {
              eventType: row.eventType,
              eventId: row.id,
            });
            return this.db.platformCommand((ctx) =>
              this.repository.markPublished(ctx.operational, [row.id], this.instanceId),
            );
          }
          await Promise.all(
            routes.map((route) => {
              const queue = this.queueMapper.get(route.queue);
              return queue.add(route.jobName ?? row.eventType, payload, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
              });
            }),
          );
          await this.db.platformCommand((ctx) =>
            this.repository.markPublished(ctx.operational, [row.id], this.instanceId),
          );
          this.logger.debug('Outbox event dispatched', {
            eventType: row.eventType,
            eventId: row.id,
            queues: routes.map((r) => r.queue),
            correlationId: getOptionalObservationContext()?.correlationId,
          });
        } catch (error) {
          await this.handleFailure(row, error);
        }
      },
    );
  }

  private async handleFailure(row: OutboxEvent, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = row.publishAttempts + 1;
    const deadLetter = attempts >= this.MAX_PUBLISH_ATTEMPTS;
    const delayMs = Math.min(this.BASE_BACKOFF_MS * 2 ** row.publishAttempts, this.MAX_BACKOFF_MS);
    const nextAttemptAt = new Date(Date.now() + delayMs);
    this.logger.error('Outbox event publish failed', {
      eventType: row.eventType,
      eventId: row.id,
      attempts,
      deadLetter,
      message,
    });
    await this.db.platformCommand((ctx) =>
      this.repository.markFailed(ctx.operational, row.id, message, nextAttemptAt, deadLetter),
    );
  }
}
