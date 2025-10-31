import { Module } from '@nestjs/common';
import { NatsModule } from '@app/nats';
import { OrderController } from './order.controller';

@Module({
  imports: [NatsModule],
  controllers: [OrderController],
})
export class OrderModule {}
