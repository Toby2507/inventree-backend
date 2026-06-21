import { bootstrapTelemetry, LOGGER, LoggerPort } from '@app/core/observability';
bootstrapTelemetry({ serviceName: 'inventree-api', serviceVersion: '1.0.0' });

import { setupSwagger } from '@app/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3000;
  const apiUrl = configService.get('API_URL', `http://localhost:${port}`);
  await app.listen(port);

  logger.log(
    `\n\n🚀 Inventree Backend is up and running!\n🌍 Environment: ${configService.get('NODE_ENV')}\n📊 Health Check: ${apiUrl}/api/health\n📚 API Documentation: ${apiUrl}/api/docs`,
  );
}
bootstrap();
