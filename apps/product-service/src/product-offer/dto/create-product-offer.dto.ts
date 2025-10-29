import {
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductOfferDto {
  /**
   * Product base identifier.
   * References an existing product base.
   * @example "507f1f77bcf86cd799439011"
   */
  @IsMongoId()
  productBaseId: string;

  /**
   * Product offer name.
   * Must be between 2 and 100 characters.
   * @example "Tomate Orgánico Chonto"
   */
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /**
   * Product offer description.
   * Must be between 10 and 300 characters.
   * @example "Tomates orgánicos cultivados sin pesticidas, cosecha reciente"
   */
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  description: string;

  /**
   * Product price in Colombian pesos.
   * Must be between 1 and 100,000,000.
   * @example 5000
   */
  @IsNumber()
  @Min(1)
  @Max(100000000)
  price: number;

  /**
   * Product image URL.
   * Must be a valid URL.
   * @example "https://example.com/images/tomate-organico.jpg"
   */
  @IsUrl({})
  imageUrl: string;

  /**
   * Unit of measure identifier.
   * References an existing unit.
   * @example "507f1f77bcf86cd799439013"
   */
  @IsMongoId()
  unitId: string;

  /**
   * Available quantity.
   * Must be between 1 and 100.
   * @example 50
   */
  @IsNumber()
  @Min(1)
  @Max(100)
  quantity: number;

  /**
   * Product availability status.
   * Indicates if the product is available for sale.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
