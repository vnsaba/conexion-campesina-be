import { NestFactory } from '@nestjs/core';
import { ClientGatewayModule } from './client-gateway.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { RpcCustomExceptionFilter } from '../common/exceptions/rpc-custom-exception.filter';

function setupSwagger(app) {
  const config = new DocumentBuilder()
    .setTitle('Conexión Campesina')
    .setDescription(
      'API para la gestión de productos, productores y compradores del marketplace agropecuario.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Servidor local')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        description: 'Enter JWT token (prefixed with "Bearer ")',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('doc', app, document, {
    customSiteTitle: 'Conexión Campesina - API Docs',
    customfavIcon: 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(ClientGatewayModule);
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new RpcCustomExceptionFilter());

  setupSwagger(app);

  await app.listen(process.env.port ?? 3000);
}

void bootstrap();
