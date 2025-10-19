import { Module } from '@nestjs/common';

import { ProductBaseModule } from './product-base/product-base.module';
import { ProductOfferModule } from './product-offer/product-offer.module';

@Module({
  imports: [ProductBaseModule, ProductOfferModule],
})
export class ProductServiceModule {}
