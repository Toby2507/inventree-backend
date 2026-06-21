import { bootstrapTelemetry, LOGGER, LoggerPort } from '@app/core/observability';
bootstrapTelemetry({ serviceName: 'inventree-worker-core', serviceVersion: '1.0.0' });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const logger = app.get<LoggerPort>(LOGGER).forContext('WorkerCore');

  app.enableShutdownHooks();
  logger.log('Worker core started');
}

bootstrap();
