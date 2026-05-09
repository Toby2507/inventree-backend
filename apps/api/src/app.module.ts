import { DomainExceptionFilter } from '@app/common';
import { validate } from '@app/config';
import { GeneratorModule } from '@app/core';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
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
    DatabaseModule,
    GeneratorModule,
    // Modules
    IdentityModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
