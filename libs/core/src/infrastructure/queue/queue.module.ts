import { bullmqConfig } from '@app/config';
import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module } from '@nestjs/common';
import { QUEUE_NAMES, type QueueName } from './queue.constants';
import { defaultJobOptions } from './queue.registry';
import { OBSERVED_QUEUE, provideObservedQueue } from './queue.token';

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
    const observedProviders = queues.map((name) => ({
      provider: provideObservedQueue(name),
      token: OBSERVED_QUEUE(name),
    }));
    return {
      module: QueueModule,
      imports: [BullModule.registerQueue(...queues.map((name) => ({ name, defaultJobOptions })))],
      providers: observedProviders.map((p) => p.provider),
      exports: observedProviders.map((p) => p.token),
    };
  }

  static registerAll(): DynamicModule {
    return this.register(...(Object.values(QUEUE_NAMES) as QueueName[]));
  }
}
