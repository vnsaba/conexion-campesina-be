import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';

import { CreateProductOfferDto } from './dto/create-product-offer.dto';
import { UpdateProductOfferDto } from './dto/update-product-offer.dto';
import { ProductOfferService } from './product-offer.service';

@Controller()
export class ProductOfferController {
  constructor(private readonly productOfferService: ProductOfferService) {}

  @MessagePattern('product.offer.create')
  create(
    @Payload()
    createdPayload: {
      createProductOfferDto: CreateProductOfferDto;
      producerId: string;
    },
  ) {
    const { createProductOfferDto, producerId } = createdPayload;
    return this.productOfferService.create(createProductOfferDto, producerId);
  }

  @MessagePattern('product.offer.findAll')
  findAll() {
    return this.productOfferService.findAll();
  }

  @MessagePattern('product.offer.findOne')
  findOne(@Payload() id: string) {
    return this.productOfferService.findOne(id);
  }

  @MessagePattern('product.offer.update')
  update(
    @Payload()
    updatePayload: {
      id: string;
      updateProductOffer: UpdateProductOfferDto;
    },
  ) {
    const { id, updateProductOffer } = updatePayload;
    return this.productOfferService.update(id, updateProductOffer);
  }

  @MessagePattern('product.offer.remove')
  remove(@Payload() id: string) {
    return this.productOfferService.remove(id);
  }

  @MessagePattern('product.offer.findAllProducer')
  findAllProduct(@Payload() producerId: string) {
    return this.productOfferService.findAllProduct(producerId);
  }

  @MessagePattern('product.offer.validateMany')
  validateMany(@Payload() ids: string[]) {
    return this.productOfferService.validateMany(ids);
  }

  @MessagePattern('product.offer.searchByName')
  findAllProductOffersByName(@Payload() name: string) {
    return this.productOfferService.findAllProductOffersByName(name);
  }

  @MessagePattern('product.offer.searchByCategory')
  findAllProductOffersByCategory(@Payload() category: string) {
    return this.productOfferService.findAllProductOffersByCategory(category);
  }

  @EventPattern('product.offer.updateAvailability')
  updateAvailability(
    @Payload() payload: { productOfferId: string; available: boolean },
  ) {
    return this.productOfferService.updateAvailability(
      payload.productOfferId,
      payload.available,
    );
  }
}
