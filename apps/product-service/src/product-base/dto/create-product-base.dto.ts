import {
  IsString,
  MinLength,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Category } from '../../../generated/prisma';

export class CreateProductBaseDto {
  /**
   * Product base name.
   * Must be between 2 and 80 characters.
   * @example "Tomate"
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  /**
   * Product category.
   * Must be one of the predefined categories.
   * @example "VERDURAS"
   */
  @IsEnum(Category, {
    message: 'La categoria debe ser alguna de las ya definidas',
  })
  category: Category;
}
