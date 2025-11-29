import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ShippingService } from './shipping.service';

@Controller()
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @MessagePattern('create.Shipping')
  create(@Payload() idOrder: string) {
    return this.shippingService.create(idOrder);
  }

  @MessagePattern('findOne.Shipping')
  findOne(@Payload() id: string) {
    return this.shippingService.findOne(id);
  }

  @MessagePattern('generate.Shipping.Document')
  generateShippingDocument(@Payload() orderId: string) {
    return this.shippingService.generateShippingDocument(orderId);
  }

  @MessagePattern('find.Receipt.By.Order')
  findReceiptByOrder(@Payload() orderId: string) {
    return this.shippingService.findReceiptByOrder(orderId);
  }
}
