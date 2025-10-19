import { Module } from '@nestjs/common';
import { NatsModule } from '@app/nats';

import { ProductBaseController } from './controllers/product.base.controller';
import { ProductOfferController } from './controllers/product.offer.controller';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [NatsModule],
  controllers: [ProductBaseController, ProductOfferController],
  providers: [RolesGuard],
})
export class ProductModule {}
