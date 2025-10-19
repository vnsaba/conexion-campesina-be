import { NestFactory } from '@nestjs/core';
import { ClientGatewayModule } from './client-gateway.module';
import { ValidationPipe } from '@nestjs/common';
import { RpcCustomExceptionFilter } from '../common/exceptions/rpc-custom-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(ClientGatewayModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new RpcCustomExceptionFilter());

  await app.listen(process.env.port ?? 3000);
}

void bootstrap();
