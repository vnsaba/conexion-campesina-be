import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { NatsModule } from '@app/nats/nats.module';

@Module({
  imports: [NatsModule],
  controllers: [ShippingController],
  providers: [ShippingService],
})
export class ShippingModule {}
