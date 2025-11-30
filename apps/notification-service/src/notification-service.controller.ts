import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationServiceService } from './notification-service.service';
import {
  NotificationPayload,
  LowStockPayload,
} from './interfaces/notification-payload.interface';

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
