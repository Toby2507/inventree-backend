import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { APP_CONFIG, AppConfig } from './environments';

const DOCUMENTATION_URL_PATH = 'api/docs';

export const setupSwagger = (app: INestApplication): OpenAPIObject => {
  const appConfig = app.get<AppConfig>(APP_CONFIG);

  const documentationOptions = new DocumentBuilder()
    .setTitle(appConfig.name)
    .setDescription('InvenTree Backend API Open Host Service (OHS) Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'Authorization',
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentationOptions);
  SwaggerModule.setup(DOCUMENTATION_URL_PATH, app, document, {
    customSiteTitle: appConfig.name,
    jsonDocumentUrl: `${DOCUMENTATION_URL_PATH}/json`,
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
  });

  return document;
};
