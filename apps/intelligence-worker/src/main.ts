import { bootstrapTelemetry, LOGGER, LoggerPort } from '@app/core/observability';
bootstrapTelemetry({ serviceName: 'inventree-intelligence-worker', serviceVersion: '1.0.0' });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = app.get<LoggerPort>(LOGGER).forContext('IntelligenceWorker');

  app.enableShutdownHooks();
  logger.log('Intelligence worker started');
}

bootstrap();
