import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  NotificationPayload,
  LowStockPayload,
} from './interfaces/notification-payload.interface';

@Injectable()
export class NotificationServiceService {
  private readonly logger = new Logger('NotificationService');

  constructor(
    @Inject(process.env.NATS_SERVICE_KEY || 'NATS_SERVICE')
    private readonly natsClient: ClientProxy,
  ) {}

  handleOrderCreated(payload: NotificationPayload): void {
    const notificationData = {
      type: 'NEW_ORDER',
      orderId: payload.orderId,
      clientName: payload.clientName,
      address: payload.address,
      totalAmount: payload.totalAmount,
      productCount: payload.productCount,
      orderDate: payload.orderDate,
    };

    payload.producerIds.forEach((producerId) => {
      this.natsClient.emit(
        `notification.producer.${producerId}`,
        notificationData,
      );
    });
  }

  handleLowStock(payload: LowStockPayload): void {
    const notificationData = {
      type: 'LOW_STOCK',
      productOfferId: payload.productOfferId,
      available_quantity: payload.available_quantity,
      minimum_threshold: payload.minimum_threshold,
    };

    this.natsClient.emit(
      `notification.producer.${payload.producerId}`,
      notificationData,
    );
  }
}
