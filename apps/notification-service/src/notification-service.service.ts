import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

export interface NotificationPayload {
  orderId: string;
  producerIds: string[];
  clientName: string;
  totalAmount: number;
  productCount: number;
  orderDate: Date;
}

export interface LowStockPayload {
  producerId: string;
  productOfferId: string;
  available_quantity: number;
  minimum_threshold: number;
}

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
