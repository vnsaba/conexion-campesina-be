import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsMongoId,
} from 'class-validator';

/**
 * DTO para crear una reseña (Review) en el microservicio de reseñas.
 * Se valida que la calificación (rating) sea un entero entre 1 y 5.
 */
export class CreateReviewDto {
  /**
   * Rating (calificación) del producto.
   * Entero entre 1 y 5.
   * @example 4
   */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  /**
   * Comentarios adicionales sobre el producto.
   * Opcional. Longitud mínima 10 y máxima 500 caracteres.
   * @example "Producto fresco y de buena calidad"
   */
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  comments?: string;

  /**
   * Identificador del ProductOffer al que pertenece la reseña.
   * Debe ser un ObjectId válido de MongoDB.
   * @example "64a1f2b3e4d5c6a7b8c9d0e1"
   */
  @IsMongoId()
  @IsNotEmpty()
  productOfferId: string;
}
