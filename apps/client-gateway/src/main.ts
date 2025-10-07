import { NestFactory } from '@nestjs/core';
import { ClientGatewayModule } from './client-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ClientGatewayModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
