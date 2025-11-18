import { Module } from '@nestjs/common';
import { InventoryServiceController } from './inventory-service.controller';
import { InventoryService } from './inventory-service.service';
import { NatsModule } from '@app/nats';
import { PrismaService } from '../provider/prisma.service';
import { UnitConverterService } from './UnitConverterService';

@Module({
  imports: [NatsModule],
  controllers: [InventoryServiceController],
  providers: [InventoryService, PrismaService, UnitConverterService],
})
export class InventoryServiceModule {}
