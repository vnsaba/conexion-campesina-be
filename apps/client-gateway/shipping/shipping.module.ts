import { Module } from '@nestjs/common';
import { NatsModule } from '@app/nats';
import { ShippingController } from './shipping.controller';

@Module({
  imports: [NatsModule],
  controllers: [ShippingController],
})
export class ShippingModule {}
