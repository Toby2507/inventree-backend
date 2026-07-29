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
import { ClockModule } from '@app/shared-kernel';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventRoutingService } from './event-router';
import { QueueMappingService } from './queue-mapper';
import { RouteDefinitions } from './route-definition';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    ObservabilityModule,
    DatabaseModule,
    OutboxModule,
    GeneratorModule,
    ClockModule,
    QueueModule.forRoot(),
    QueueModule.registerAll(),
  ],
  providers: [
    OutboxProcessorService,
    RouteDefinitions,
    { provide: QUEUE_MAPPER, useClass: QueueMappingService },
    { provide: EVENT_ROUTER, useClass: EventRoutingService },
  ],
})
export class AppModule {}
