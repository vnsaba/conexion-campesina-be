import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

const NATS_SERVERS = process.env.NATS_SERVERS?.split(',');

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthServiceModule,
    {
      transport: Transport.NATS,
      options: {
        servers: NATS_SERVERS,
      },
    },
  );

  await app.listen();
}

void bootstrap();
