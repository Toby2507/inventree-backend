import { DomainExceptionFilter } from '@app/common/filters';
import { GeneratorModule } from '@app/core/generators';
import { RedisModule } from '@app/core/infrastructure/redis';
import { ObservabilityModule, ObservationContextMiddleware } from '@app/core/observability';
import { IdempotencyModule } from '@app/core/reliability/idempotency';
import { SecurityModule } from '@app/core/security';
import { DatabaseModule } from '@app/database';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IdentityModule } from './identity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    CqrsModule.forRoot(),
    ScheduleModule.forRoot(),
    // Globals
    ObservabilityModule,
    DatabaseModule,
    GeneratorModule,
    IdempotencyModule,
    RedisModule,
    SecurityModule,
    // Modules
    IdentityModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ObservationContextMiddleware).forRoutes('api/*path');
  }
}
