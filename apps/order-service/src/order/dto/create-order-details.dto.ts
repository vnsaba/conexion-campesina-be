import { IsString, IsNumber, IsPositive, MinLength } from 'class-validator';

export class CreateOrderDetailsDto {
  @IsString()
  @MinLength(1)
  productOfferId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  price: number;
}
