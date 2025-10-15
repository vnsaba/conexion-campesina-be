import { NestFactory } from '@nestjs/core';
import { ClientGatewayModule } from './client-gateway.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ClientGatewayModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.port ?? 3000);
}

void bootstrap();
