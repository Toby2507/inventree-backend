import { appConfig } from '@app/config';
import { GeneratorModule } from '@app/core/generators';
import { RedisModule } from '@app/core/infrastructure/redis';
import { ObservabilityModule, ObservationContextMiddleware } from '@app/core/observability';
import { IdempotencyModule } from '@app/core/reliability/idempotency';
import { CryptographyModule } from '@app/core/security/cryptography';
import { DatabaseModule } from '@app/database';
import { LayerExceptionFilter } from '@app/framework/nest/filters';
import { InfrastructureExceptionFilter } from '@app/framework/nest/filters/infrastructure-exception.filter';
import { ClockModule } from '@app/shared-kernel';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { IdentityModule } from './identity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [appConfig] }),
    CqrsModule.forRoot(),
    ScheduleModule.forRoot(),
    // Globals
    ObservabilityModule,
    DatabaseModule,
    GeneratorModule,
    IdempotencyModule,
    RedisModule,
    CryptographyModule,
    ClockModule,
    // Modules
    IdentityModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: LayerExceptionFilter },
    { provide: APP_FILTER, useClass: InfrastructureExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ObservationContextMiddleware).forRoutes('api/*path');
  }
}
