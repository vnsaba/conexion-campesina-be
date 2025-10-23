import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [AuthModule, ProductModule, OrderModule],
})
export class ClientGatewayModule {}
