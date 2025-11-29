import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { InventoryServiceController } from './inventory-service.controller';
import { InventoryService } from './inventory-service.service';
import { PrismaService } from '../provider/prisma.service';
import { UnitConverterService } from './UnitConverterService';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ClientsModule.register([
      {
        name: 'NATS_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_SERVERS || 'nats://localhost:4222'],
        },
      },
    ]),
  ],
  controllers: [InventoryServiceController],
  providers: [InventoryService, PrismaService, UnitConverterService],
})
export class InventoryServiceModule {}
