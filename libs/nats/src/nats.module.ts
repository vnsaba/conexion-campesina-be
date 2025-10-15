import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

const NATS_SERVERS = process.env.NATS_SERVERS?.split(',');
const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY!;

@Module({
  imports: [
    ClientsModule.register([
      {
        name: NATS_SERVICE_KEY,
        transport: Transport.NATS,
        options: {
          servers: NATS_SERVERS,
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class NatsModule {}
