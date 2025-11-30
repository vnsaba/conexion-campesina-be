import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { PaidOrderDto } from './dto/paid-order.dto';
import { OrderWithProducts } from './interfaces/order-with-product.interface';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern('order.create')
  async create(
    @Payload()
    payload: {
      clientId: string;
      createOrderDto: CreateOrderDto;
    },
  ) {
    const { clientId, createOrderDto } = payload;

    const order = await this.orderService.create(clientId, createOrderDto);
    const paymentSession = await this.orderService.createPaymentSession(
      order as OrderWithProducts,
    );

    return { order, paymentSession };
  }

  @MessagePattern('order.findAll')
  findAll(@Payload() paginationDto: OrderPaginationDto) {
    return this.orderService.findAll(paginationDto);
  }

  @MessagePattern('order.findOne')
  findOne(@Payload() id: string) {
    return this.orderService.findOne(id);
  }

  @MessagePattern('order.remove')
  remove(@Payload() id: string) {
    return this.orderService.remove(id);
  }

  @MessagePattern('order.findByClientId')
  findByClientId(@Payload() clientId: string) {
    return this.orderService.findByClientId(clientId);
  }

  @MessagePattern('order.findByProducerId')
  findByProducerId(@Payload() producerId: string) {
    return this.orderService.findByProducerId(producerId);
  }

  @MessagePattern('order.getOrderDetails')
  getOrderDetails(@Payload() orderId: string) {
    return this.orderService.getOrderDetails(orderId);
  }

  @MessagePattern('order.existsProductOffer')
  existsProductOffer(@Payload() productOfferId: string) {
    return this.orderService.existsProductOffer(productOfferId);
  }

  @EventPattern('payment.paid')
  async paidOrder(@Payload() paidOrderDto: PaidOrderDto) {
    console.log(
      `Received payment.paid event for order: ${paidOrderDto.orderId}`,
    );
    await this.orderService.paidOrder(paidOrderDto);
  }

  // En OrderController

  @MessagePattern('order.retryPayment')
  retryPayment(@Payload() orderId: string) {
    return this.orderService.retryPayment(orderId);
  }

  @MessagePattern('order.existsProductOffer')
  existsProductOrderClient(
    @Payload()
    payloadProductOrder: {
      productOfferId: string;
      clientId: string;
    },
  ) {
    const { productOfferId, clientId } = payloadProductOrder;
    return this.orderService.existsProductOrderClient(productOfferId, clientId);
  }
}
