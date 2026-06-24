import { bootstrapTelemetry, LOGGER, LoggerPort } from '@app/core/observability';
bootstrapTelemetry({ serviceName: 'inventree-api', serviceVersion: '1.0.0' });

import { APP_CONFIG, AppConfig, setupSwagger } from '@app/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = app.get<LoggerPort>(LOGGER).forContext('ApiService');

  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: '*', credentials: true });
  app.enableVersioning({ type: VersioningType.URI });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  setupSwagger(app);

  const appConfig = app.get<AppConfig>(APP_CONFIG);
  const healthUrl = `${appConfig.apiUrl}/api/health`;
  const docsUrl = `${appConfig.apiUrl}/api/docs`;

  await app.listen(appConfig.port);
  logger.log(`
🚀 Inventree Backend is up and running!
🌍 Environment: ${appConfig.environment}
📊 Health Check: ${healthUrl}
📚 API Documentation: ${docsUrl}
  `);
}
bootstrap();
