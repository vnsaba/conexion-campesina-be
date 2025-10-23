import { Module } from '@nestjs/common';

import { ProductBaseModule } from './product-base/product-base.module';
import { ProductOfferModule } from './product-offer/product-offer.module';
import { UnitModule } from './unit/unit.module';

@Module({
  imports: [ProductBaseModule, ProductOfferModule, UnitModule],
})
export class ProductServiceModule {}
