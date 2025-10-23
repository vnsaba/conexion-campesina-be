import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern('order.create')
  create(@Payload() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }

  @MessagePattern('order.findAll')
  findAll() {
    return this.orderService.findAll();
  }

  @MessagePattern('order.findOne')
  findOne(@Payload() id: string) {
    return this.orderService.findOne(id);
  }

  @MessagePattern('order.update')
  update(
    @Payload()
    updatePayload: {
      id: string;
      updateOrder: UpdateOrderDto;
    },
  ) {
    const { id, updateOrder } = updatePayload;
    return this.orderService.update(id, updateOrder);
  }

  @MessagePattern('order.remove')
  remove(@Payload() id: string) {
    return this.orderService.remove(id);
  }

  @MessagePattern('order.findByClientId')
  findByClientId(@Payload() clientId: string) {
    return this.orderService.findByClientId(clientId);
  }

  @MessagePattern('order.getOrderDetails')
  getOrderDetails(@Payload() orderId: string) {
    return this.orderService.getOrderDetails(orderId);
  }
}
