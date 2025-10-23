import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import { IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../../generated/prisma';
import { CreateOrderDetailsDto } from './create-order-details.dto';
import { OrderStatusList } from '../enum/order.enum';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `El status debe ser uno de los siguientes: ${OrderStatusList.join(', ')}`,
  })
  status?: OrderStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDetailsDto)
  orderDetails?: CreateOrderDetailsDto[];
}
