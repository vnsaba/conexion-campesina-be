import { IsString, IsArray, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderDetailsDto } from './create-order-details.dto';

export class CreateOrderDto {
  @IsString()
  @MinLength(5)
  address: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDetailsDto)
  orderDetails: CreateOrderDetailsDto[];
}
