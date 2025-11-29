import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { OrderModule } from '../order/order.module';
import { ReviewModule } from '../review/review.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    AuthModule,
    ProductModule,
    OrderModule,
    ReviewModule,
    InventoryModule,
  ],
})
export class ClientGatewayModule {}
