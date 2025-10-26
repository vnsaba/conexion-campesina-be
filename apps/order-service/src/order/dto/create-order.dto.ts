import {
  IsString,
  IsArray,
  ValidateNested,
  IsEnum,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../../generated/prisma';
import { CreateOrderDetailsDto } from './create-order-details.dto';
import { OrderStatusList } from '../enum/order.enum';

export class CreateOrderDto {
  @IsEnum(OrderStatus, {
    message: `El status debe ser uno de los siguientes: ${OrderStatusList.join(', ')}`,
  })
  status?: OrderStatus;

  @IsString()
  @MinLength(5)
  address: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDetailsDto)
  orderDetails: CreateOrderDetailsDto[];
}
