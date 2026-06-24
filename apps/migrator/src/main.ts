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
    await migrationService.migrateAllToLatest();
    logger.log('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap();
