import { initObservability } from '@app/core';
initObservability({ serviceName: 'inventree-migrator-service', serviceVersion: '1.0.0' });

import { MigrationService } from '@app/database';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Migrator');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    logger.log('Starting database migration');
    const migrationService = app.get(MigrationService);
    await migrationService.onApplicationBootstrap();
    logger.log('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.log('Migration failed', error);
    process.exit(1);
  }
}

bootstrap();
