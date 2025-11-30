import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationServiceController } from './notification-service.controller';
import { NotificationServiceService } from './notification-service.service';

const NATS_SERVERS = process.env.NATS_SERVERS?.split(',');
const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY || 'NATS_SERVICE';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: NATS_SERVICE_KEY,
        transport: Transport.NATS,
        options: {
          servers: NATS_SERVERS || ['nats://localhost:4222'],
        },
      },
    ]),
  ],
  controllers: [NotificationServiceController],
  providers: [NotificationServiceService],
})
export class NotificationServiceModule {}
