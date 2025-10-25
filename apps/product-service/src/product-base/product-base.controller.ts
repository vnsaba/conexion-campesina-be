import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreateProductBaseDto } from './dto/create-product-base.dto';
import { UpdateProductBaseDto } from './dto/update-product-base.dto';
import { ProductBaseService } from './product-base.service';

@Controller()
export class ProductBaseController {
  constructor(private readonly productBaseService: ProductBaseService) {}

  @MessagePattern('product.base.create')
  create(@Payload() createProductBaseDto: CreateProductBaseDto) {
    return this.productBaseService.create(createProductBaseDto);
  }

  @MessagePattern('product.base.findAll')
  findAll() {
    return this.productBaseService.findAll();
  }

  @MessagePattern('product.base.findOne')
  findOne(@Payload() id: string) {
    return this.productBaseService.findOne(id);
  }

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

  @MessagePattern('product.base.remove')
  remove(@Payload() id: string) {
    return this.productBaseService.remove(id);
  }
}
