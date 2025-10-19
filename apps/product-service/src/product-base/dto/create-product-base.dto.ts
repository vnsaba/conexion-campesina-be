import { IsString, MinLength, IsEnum } from 'class-validator';
import { Category } from '../../../generated/prisma';

export class CreateProductBaseDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(Category, {
    message: 'La categoria debe ser alguna de las ya definidas',
  })
  category: Category;
}
