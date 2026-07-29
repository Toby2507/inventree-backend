import { bootstrapTelemetry, LOGGER, type Logger } from '@app/core/observability';
bootstrapTelemetry({ serviceName: 'inventree-outbox-processor', serviceVersion: '1.0.0' });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = app.get<Logger>(LOGGER).forContext('OutboxProcessor');

  app.enableShutdownHooks();
  logger.log('Outbox processor started');
}

bootstrap();
