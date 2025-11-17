import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { ReviewModule } from './review.module';

const NATS_SERVERS = process.env.NATS_SERVERS?.split(',');

async function bootstrap() {
  const logger = new Logger('ReviewService');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ReviewModule,
    {
      transport: Transport.NATS,
      options: {
        servers: NATS_SERVERS,
      },
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen();
  logger.log('Review Service is running');
}

void bootstrap();
