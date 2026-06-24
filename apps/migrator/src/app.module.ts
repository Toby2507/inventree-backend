import { ObservabilityModule } from '@app/core/observability';
import { MigrationModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    MigrationModule,
    ObservabilityModule,
  ],
})
export class AppModule {}
