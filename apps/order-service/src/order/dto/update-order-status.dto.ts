import { OrderStatus } from '../../../generated/prisma';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsNotEmpty()
  @IsEnum(OrderStatus, {
    message:
      'the status must be one of the following values: ' +
      Object.values(OrderStatus).join(', '),
  })
  status: OrderStatus;
}
