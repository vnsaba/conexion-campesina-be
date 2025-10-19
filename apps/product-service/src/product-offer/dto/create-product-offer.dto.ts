import {
  IsInt,
  IsMongoId,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductOfferDto {
  @IsMongoId()
  productBaseId: string;

  @IsString()
  @MinLength(1)
  producerId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(10)
  @MaxLength(300)
  description: string;

  @IsInt()
  @Min(10)
  price: number;

  @IsUrl()
  imageUrl: string;
}
