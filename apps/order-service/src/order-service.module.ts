import { Module } from '@nestjs/common';
import { OrderModule } from './order/order.module';

@Module({
  imports: [OrderModule],
})
export class OrderServiceModule {}
