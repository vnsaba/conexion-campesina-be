import {
  IsString,
  MinLength,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Category } from '../../../generated/prisma';

export class CreateProductBaseDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsEnum(Category, {
    message: 'La categoria debe ser alguna de las ya definidas',
  })
  category: Category;
}
