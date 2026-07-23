import { ObservabilityModule } from '@app/core/observability';
import { MigrationModule } from '@app/database';
import { ClockModule } from '@app/shared-kernel';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    MigrationModule,
    ObservabilityModule,
    ClockModule,
  ],
})
export class AppModule {}
