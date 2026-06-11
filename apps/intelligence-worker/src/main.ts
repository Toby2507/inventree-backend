import { bootstrapTelemetry } from '@app/core/observability';
bootstrapTelemetry({ serviceName: 'inventree-intelligence-worker', serviceVersion: '1.0.0' });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Intelligence Worker');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();
  logger.log('Intelligence worker started');
}

bootstrap();
