import { OrderStatus } from '../../../generated/prisma';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsNotEmpty()
  @IsEnum(OrderStatus, {
    message: 'El estado debe ser uno de los ya definidos',
  })
  status: OrderStatus;
}
