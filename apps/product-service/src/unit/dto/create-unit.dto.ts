import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MeasureType } from '../../../generated/prisma';

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(12)
  symbol: string;

  @IsEnum(MeasureType)
  type: MeasureType;

  @IsString()
  @IsOptional()
  @MinLength(5)
  @MaxLength(300)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0.000001, { message: 'equivalentValue debe ser mayor que 0' })
  equivalentValue?: number;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  baseUnit?: string;
}
