import { bootstrapTelemetry, LOGGER, LoggerPort } from '@app/core/observability';
bootstrapTelemetry({ serviceName: 'inventree-migrator-service', serviceVersion: '1.0.0' });

import { MigrationService } from '@app/database';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = app.get<LoggerPort>(LOGGER).forContext('Migrator');

  try {
    logger.log('Starting database migration');
    const migrationService = app.get(MigrationService);
    await migrationService.onApplicationBootstrap();
    logger.log('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exit(1);
  }
}

bootstrap();
