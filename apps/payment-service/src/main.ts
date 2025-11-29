import { NestFactory } from '@nestjs/core';
import { PaymentServiceModule } from './payment-service.module';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const logger = new Logger('PaymentService');
  logger.log('Starting Payment Service...');

  // 1. Crear la aplicación HTTP (para el Webhook de Stripe)
  const app = await NestFactory.create(PaymentServiceModule, {
    rawBody: true, // Vital para verificar la firma de Stripe
  });

  // 2. Conectar el Microservicio NATS (para hablar con Order Service)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_SERVERS || 'nats://localhost:4222'],
    },
  });

  // 3. Iniciar AMBOS servicios
  await app.startAllMicroservices(); // <--- ¡ESTO FALTABA! Inicia NATS
  await app.listen(process.env.PORT || 3003); // Inicia HTTP

  logger.log(
    `Payment Service running on HTTP port ${process.env.PORT || 3003} and NATS`,
  );
}

void bootstrap();
