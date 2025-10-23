import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import { IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../../generated/prisma';
import { CreateOrderDetailsDto } from '../../order-details/dto/create-order-details.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: 'El status debe ser alguno de los ya definidos en el enum',
  })
  status?: OrderStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDetailsDto)
  orderDetails?: CreateOrderDetailsDto[];
}
