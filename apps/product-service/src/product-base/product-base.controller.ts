import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreateProductBaseDto } from './dto/create-product-base.dto';
import { UpdateProductBaseDto } from './dto/update-product-base.dto';
import { ProductBaseService } from './product-base.service';

/**
 * Controller responsible for handling ProductBase microservice messages
 */
@Controller()
export class ProductBaseController {
  constructor(private readonly productBaseService: ProductBaseService) {}

  /**
   * Creates a new product base
   * @param createProductBaseDto - Product base data
   * @returns The created product base
   */
  @MessagePattern('product.base.create')
  create(@Payload() createProductBaseDto: CreateProductBaseDto) {
    return this.productBaseService.create(createProductBaseDto);
  }

  /**
   * Retrieves all product bases
   * @returns Array of product bases
   */
  @MessagePattern('product.base.findAll')
  findAll() {
    return this.productBaseService.findAll();
  }

  /**
   * Retrieves a single product base by ID
   * @param id - Product base ID
   * @returns The product base
   */
  @MessagePattern('product.base.findOne')
  findOne(@Payload() id: string) {
    return this.productBaseService.findOne(id);
  }

  /**
   * Updates a product base
   * @param updatePayload - Object containing id and data to update
   * @returns The updated product base
   */
  @MessagePattern('product.base.update')
  update(
    @Payload()
    updatePayload: {
      id: string;
      updateProductBase: UpdateProductBaseDto;
    },
  ) {
    const { id, updateProductBase } = updatePayload;
    return this.productBaseService.update(id, updateProductBase);
  }

  /**
   * Deletes a product base
   * @param id - Product base ID
   * @returns Confirmation message
   */
  @MessagePattern('product.base.remove')
  remove(@Payload() id: string) {
    return this.productBaseService.remove(id);
  }

  @MessagePattern('product.base.getCategories')
  getCategories() {
    return this.productBaseService.getCategories();
  }
}
