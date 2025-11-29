import { NestFactory } from '@nestjs/core';
import { InventoryServiceModule } from './inventory-service.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
const NATS_SERVERS = process.env.NATS_SERVERS?.split(',');

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    InventoryServiceModule,
    {
      transport: Transport.NATS,
      options: {
        servers: NATS_SERVERS,
      },
    },
  );

  await app.listen();
}
bootstrap();
