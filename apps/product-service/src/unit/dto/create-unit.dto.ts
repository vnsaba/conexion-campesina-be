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
  /**
   * Unit name.
   * Must be between 2 and 60 characters.
   * @example "Kilogramo"
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  /**
   * Unit symbol or abbreviation.
   * Must be between 1 and 12 characters.
   * @example "kg"
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(12)
  symbol: string;

  /**
   * Type of measurement.
   * Must be one of: WEIGHT, VOLUME, COUNT, LENGTH, AREA, OTHER.
   * @example "WEIGHT"
   */
  @IsEnum(MeasureType)
  type: MeasureType;

  /**
   * Unit description (optional).
   * Must be between 5 and 300 characters.
   * @example "Unidad de medida de peso en el sistema métrico"
   */
  @IsString()
  @IsOptional()
  @MinLength(5)
  @MaxLength(300)
  description?: string;

  /**
   * Equivalent value to the base unit (optional).
   * Must be greater than 0.
   * @example 1.0
   */
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0.000001, { message: 'equivalentValue debe ser mayor que 0' })
  equivalentValue?: number;

  /**
   * Base unit of reference (optional).
   * Must be between 1 and 50 characters.
   * @example "Gramo"
   */
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  baseUnit?: string;
}
