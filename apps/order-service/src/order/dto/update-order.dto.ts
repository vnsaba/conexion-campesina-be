import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../generated/prisma';
import { OrderStatusList } from '../enum/order.enum';

export class UpdateOrderDto {
  @IsEnum(OrderStatus, {
    message: `Valid status are: ${OrderStatusList.join(', ')}`,
  })
  status: OrderStatus;
}
