import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  NotificationServiceService,
  NotificationPayload,
  LowStockPayload,
} from './notification-service.service';

@Controller()
export class NotificationServiceController {
  constructor(
    private readonly notificationService: NotificationServiceService,
  ) {}

  @EventPattern('notification.order.created')
  handleOrderCreated(@Payload() payload: NotificationPayload) {
    this.notificationService.handleOrderCreated(payload);
  }

  @EventPattern('inventory.lowStock')
  handleLowStock(@Payload() payload: LowStockPayload) {
    this.notificationService.handleLowStock(payload);
  }
}
