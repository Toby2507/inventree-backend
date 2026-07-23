import { ObservabilityModule } from '@app/core/observability';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailProcessorModule } from './email/email.module';
import { QUEUE_NAMES, QueueModule } from '@app/core/infrastructure/queue';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ObservabilityModule,
    // Queue
    QueueModule.forRoot(),
    QueueModule.register(QUEUE_NAMES.EMAIL),
    // Processor Modules
    EmailProcessorModule,
  ],
})
export class AppModule {}
