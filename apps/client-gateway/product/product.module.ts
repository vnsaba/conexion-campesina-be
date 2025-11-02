import { Module } from '@nestjs/common';
import { NatsModule } from '@app/nats';

import { ProductBaseController } from './controllers/product.base.controller';
import { ProductOfferController } from './controllers/product.offer.controller';

@Module({
  imports: [NatsModule],
  controllers: [ProductBaseController, ProductOfferController],
})
export class ProductModule {}
