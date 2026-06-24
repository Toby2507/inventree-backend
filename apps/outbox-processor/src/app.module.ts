import { GeneratorModule } from '@app/core/generators';
import { QueueModule } from '@app/core/infrastructure/queue';
import { ObservabilityModule } from '@app/core/observability';
import {
  EVENT_ROUTER,
  OutboxModule,
  OutboxProcessorService,
  QUEUE_MAPPER,
} from '@app/core/reliability/outbox';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventRouter } from './event-router';
import { QueueMapper } from './queue-mapper';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    ObservabilityModule,
    DatabaseModule,
    OutboxModule,
    GeneratorModule,
    QueueModule.forRoot(),
    QueueModule.registerAll(),
  ],
  providers: [
    OutboxProcessorService,
    { provide: QUEUE_MAPPER, useClass: QueueMapper },
    { provide: EVENT_ROUTER, useClass: EventRouter },
  ],
})
export class AppModule {}
