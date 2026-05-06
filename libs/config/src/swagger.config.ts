import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

const DOCUMENTATION_URL_PATH = 'api/docs';

export const setupSwagger = (app: INestApplication): OpenAPIObject => {
  const configService = app.get(ConfigService);
  const appName = configService.get<string>('APP_NAME')!;

  const documentationOptions = new DocumentBuilder()
    .setTitle(appName)
    .setDescription('InvenTree Backend API Open Host Service (OHS) Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'Authorization',
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentationOptions);
  SwaggerModule.setup(DOCUMENTATION_URL_PATH, app, document, {
    customSiteTitle: appName,
    jsonDocumentUrl: `${DOCUMENTATION_URL_PATH}/json`,
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
  });

  return document;
};
