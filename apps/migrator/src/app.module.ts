import { validate } from '@app/config';
import { ObservabilityModule } from '@app/core/observability';
import { MigrationModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    MigrationModule,
    ObservabilityModule,
  ],
})
export class AppModule {}
