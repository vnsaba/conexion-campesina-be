import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { NatsModule } from '@app/nats';

@Module({
  controllers: [InventoryController],
  imports: [NatsModule],
})
export class InventoryModule {}
