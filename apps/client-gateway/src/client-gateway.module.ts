import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { OrderModule } from '../order/order.module';
import { ReviewModule } from '../review/review.module';
import { ShippingModule } from '../shipping/shipping.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    AuthModule,
    ProductModule,
    OrderModule,
    ReviewModule,
    ShippingModule,
    InventoryModule,
    NotificationModule,
  ],
})
export class ClientGatewayModule {}
