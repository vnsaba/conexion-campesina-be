import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreateProductOfferDto } from './dto/create-product-offer.dto';
import { UpdateProductOfferDto } from './dto/update-product-offer.dto';
import { ProductOfferService } from './product-offer.service';

/**
 * Controller responsible for handling ProductOffer microservice messages
 */
@Controller()
export class ProductOfferController {
  constructor(private readonly productOfferService: ProductOfferService) {}

  /**
   * Creates a new product offer
   * @param createProductOfferDto - Product offer data
   * @returns The created product offer
   */
  @MessagePattern('product.offer.create')
  create(@Payload() createProductOfferDto: CreateProductOfferDto) {
    return this.productOfferService.create(createProductOfferDto);
  }

  /**
   * Retrieves all product offers
   * @returns Array of product offers
   */
  @MessagePattern('product.offer.findAll')
  findAll() {
    return this.productOfferService.findAll();
  }

  /**
   * Retrieves a single product offer by ID
   * @param id - Product offer ID
   * @returns The product offer
   */
  @MessagePattern('product.offer.findOne')
  findOne(@Payload() id: string) {
    return this.productOfferService.findOne(id);
  }

  /**
   * Updates a product offer
   * @param updatePayload - Object containing id and data to update
   * @returns The updated product offer
   */
  @MessagePattern('product.offer.update')
  update(
    @Payload() updatePayload: { id: string; data: UpdateProductOfferDto },
  ) {
    const { id, data } = updatePayload;
    return this.productOfferService.update(id, data);
  }

  /**
   * Deletes a product offer
   * @param id - Product offer ID
   * @returns Confirmation message
   */
  @MessagePattern('product.offer.remove')
  remove(@Payload() id: string) {
    return this.productOfferService.remove(id);
  }
}
