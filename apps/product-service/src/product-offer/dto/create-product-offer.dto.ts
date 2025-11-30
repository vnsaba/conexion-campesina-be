import {
  IsBoolean,
  IsEnum,
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
import { Unit } from '../../../generated/prisma';

export class CreateProductOfferDto {
  /**
   * Identificador del producto base.
   * Referencia a un producto base existente.
   * @example "507f1f77bcf86cd799439011"
   */
  @IsMongoId()
  productBaseId: string;

  /**
   * Nombre de la oferta del producto.
   * Debe tener entre 2 y 100 caracteres.
   * @example "Tomate Orgánico Chonto"
   */
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /**
   * Descripción de la oferta del producto.
   * Debe tener entre 10 y 300 caracteres.
   * @example "Tomates orgánicos cultivados sin pesticidas, cosecha reciente"
   */
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  description: string;

  /**
   * Precio del producto en pesos colombianos.
   * Debe estar entre 1 y 100,000,000.
   * @example 5000
   */
  @IsNumber()
  @Min(1)
  @Max(100000000)
  price: number;

  /**
   * URL de la imagen del producto.
   * Debe ser una URL válida.
   * @example "https://example.com/images/tomate-organico.jpg"
   */
  @IsUrl()
  imageUrl: string;

  /**
   * Unidad de medida del producto.
   * Debe ser una unidad válida del enum Unit.
   * @example "KILOGRAMO"
   */
  @IsEnum(Unit)
  unit: Unit;

  /**
   * Cantidad disponible.
   * Debe estar entre 1 y 100.
   * @example 50
   */
  @IsNumber()
  @Min(1)
  quantity: number;

  /**
   * Estado de disponibilidad del producto.
   * Indica si está disponible para la venta.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
