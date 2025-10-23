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
  @IsMongoId()
  productBaseId: string;

  @IsString()
  @MinLength(1)
  producerId: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  description: string;

  @IsNumber()
  @Min(1)
  @Max(100000000)
  price: number;

  @IsUrl({})
  imageUrl: string;

  @IsMongoId()
  unitId: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  quantity: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
