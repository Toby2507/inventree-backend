import { ObservabilityModule } from '@app/core/observability';
import { DatabaseModule } from '@app/database';
import { ClockModule } from '@app/shared-kernel';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ObservabilityModule,
    ClockModule,
  ],
})
export class AppModule {}
