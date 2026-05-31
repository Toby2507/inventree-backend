import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from './interceptors';
import { RequestLoggerInterceptor } from './interceptors/request-logger.interceptor';
import { AppLoggerService } from './logger/app-logger.service';
import { MetricsService } from './metrics';
import { LOGGER, METRICS } from './ports';

@Global()
@Module({
  providers: [
    { provide: LOGGER, useClass: AppLoggerService },
    { provide: METRICS, useClass: MetricsService },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
  ],
  exports: [LOGGER, METRICS],
})
export class ObservabilityModule {}
