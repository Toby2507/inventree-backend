import { DomainExceptionFilter } from '@app/common';
import { validate } from '@app/config';
import { GeneratorModule, ObservabilityModule, ObservationContextMiddleware } from '@app/core';
import { DatabaseModule } from '@app/database';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IdentityModule } from './identity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    CqrsModule.forRoot(),
    // Globals
    ObservabilityModule,
    DatabaseModule,
    GeneratorModule,
    // Modules
    IdentityModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ObservationContextMiddleware).forRoutes('*');
  }
}
