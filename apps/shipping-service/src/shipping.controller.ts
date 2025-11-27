import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ShippingService } from './shipping.service';

@Controller()
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @MessagePattern('createShipping')
  create(@Payload() idOrder: string) {
    return this.shippingService.create(idOrder);
  }

  @MessagePattern('findOneShipping')
  findOne(@Payload() id: string) {
    return this.shippingService.findOne(id);
  }
}
