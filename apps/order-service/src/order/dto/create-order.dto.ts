import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderDetailsDto } from './create-order-details.dto';

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDetailsDto)
  orderDetails: CreateOrderDetailsDto[];
}
