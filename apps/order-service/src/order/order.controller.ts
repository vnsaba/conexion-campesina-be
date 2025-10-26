import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderPaginationDto } from './dto/order-pagination.dto';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern('order.create')
  create(
    @Payload()
    payload: {
      clientId: string;
      createOrderDto: CreateOrderDto;
    },
  ) {
    const { clientId, createOrderDto } = payload;
    return this.orderService.create(clientId, createOrderDto);
  }

  @MessagePattern('order.findAll')
  findAll(@Payload() paginationDto: OrderPaginationDto) {
    return this.orderService.findAll(paginationDto);
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
