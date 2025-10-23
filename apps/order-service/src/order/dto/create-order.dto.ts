import {
  IsString,
  IsArray,
  ValidateNested,
  IsEnum,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../../generated/prisma';
import { CreateOrderDetailsDto } from '../../order-details/dto/create-order-details.dto';

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  clientId: string;

  @IsEnum(OrderStatus, {
    message: 'El status debe ser alguno de los ya definidos en el enum',
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
