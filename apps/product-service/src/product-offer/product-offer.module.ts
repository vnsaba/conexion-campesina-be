import { Module } from '@nestjs/common';
import { ProductOfferService } from './product-offer.service';
import { ProductOfferController } from './product-offer.controller';

@Module({
  controllers: [ProductOfferController],
  providers: [ProductOfferService],
})
export class ProductOfferModule {}
