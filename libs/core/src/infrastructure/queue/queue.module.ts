import { bullmqConfig } from '@app/config';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { QUEUE_NAMES, QueueName } from './queue.constants';
import { defaultJobOptions } from './queue.registry';

@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      imports: [BullModule.forRootAsync(bullmqConfig)],
      exports: [BullModule],
      global: true,
    };
  }

  static register(...queues: QueueName[]): DynamicModule {
    return {
      module: QueueModule,
      imports: [BullModule.registerQueue(...queues.map((name) => ({ name, defaultJobOptions })))],
      exports: [BullModule],
    };
  }

  static registerAll(): DynamicModule {
    return this.register(...(Object.values(QUEUE_NAMES) as QueueName[]));
  }
}
