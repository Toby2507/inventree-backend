import { bootstrapTelemetry, LOGGER, LoggerPort } from '@app/core/observability';
bootstrapTelemetry({ serviceName: 'inventree-report-worker', serviceVersion: '1.0.0' });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = app.get<LoggerPort>(LOGGER).forContext('ReportWorker');

  app.enableShutdownHooks();
  logger.log('Report worker started');
}

bootstrap();
