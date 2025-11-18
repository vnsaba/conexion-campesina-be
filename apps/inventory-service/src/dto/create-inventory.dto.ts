import { Unit } from 'apps/inventory-service/generated/prisma';
import { Type } from 'class-transformer';

import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateInventoryDto {
  @IsString()
  @IsNotEmpty()
  producerId: string;

  @IsString()
  @IsNotEmpty()
  productOfferId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'available_quantity must be >= 0' })
  @IsNotEmpty()
  available_quantity: number;

  @IsEnum(Unit)
  unit: Unit;

  @IsNumber()
  @Min(0, { message: 'minimum_threshold must be >= 0' })
  minimum_threshold: number = 0;

  @IsNumber()
  @Min(1, { message: 'maximum_capacity must be >= 1 if provided' })
  @IsNotEmpty()
  maximum_capacity: number;
}
