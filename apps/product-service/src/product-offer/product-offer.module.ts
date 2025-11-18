import { Module } from '@nestjs/common';
import { ProductOfferService } from './product-offer.service';
import { ProductOfferController } from './product-offer.controller';
import { NatsModule } from '@app/nats/nats.module';

@Module({
  imports: [NatsModule],
  controllers: [ProductOfferController],
  providers: [ProductOfferService],
})
export class ProductOfferModule {}
