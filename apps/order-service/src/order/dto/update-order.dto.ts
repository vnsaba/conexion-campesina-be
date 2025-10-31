import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../generated/prisma';
import { OrderStatusList } from '../enum/order.enum';

export class UpdateOrderDto {
  @IsEnum(OrderStatus, {
    message: `El status debe ser uno de los siguientes: ${OrderStatusList.join(', ')}`,
  })
  status: OrderStatus;
}
