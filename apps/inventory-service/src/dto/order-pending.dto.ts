import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class OrderPendingDto {
  @IsString()
  @IsNotEmpty()
  productOfferId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}
