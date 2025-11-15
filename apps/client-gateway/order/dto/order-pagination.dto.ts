import { IsEnum, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class OrderPaginationDto {
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `Valid status are: ${Object.values(OrderStatus).join(', ')}`,
  })
  status?: OrderStatus;
}
