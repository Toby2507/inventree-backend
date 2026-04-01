import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MigrationService } from '@app/database';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Migrator');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    logger.log('Starting database migration');
    const migrationService = app.get(MigrationService);
    await migrationService.migrateToLatest();
    logger.log('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
}

bootstrap();
