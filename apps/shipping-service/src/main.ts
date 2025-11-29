import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { ShippingModule } from './shipping.module';

const NATS_SERVERS = process.env.NATS_SERVERS?.split(',');

async function bootstrap() {
  const logger = new Logger('ShippingService');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ShippingModule,
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
  logger.log('Shipping Service is running');
}

void bootstrap();
