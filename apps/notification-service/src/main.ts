import { NestFactory } from '@nestjs/core';
import { NotificationServiceModule } from './notification-service.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

const NATS_SERVERS = process.env.NATS_SERVERS?.split(',');

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
    {
      transport: Transport.NATS,
      options: {
        servers: NATS_SERVERS || ['nats://localhost:4222'],
      },
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen();
}

void bootstrap();
