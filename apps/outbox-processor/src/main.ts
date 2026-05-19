import { initObservability } from '@app/core';
initObservability({ serviceName: 'inventree-outbox-processor', serviceVersion: '1.0.0' });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('OutboxProcessor');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();
  logger.log('Outbox processor started');
}

bootstrap();
