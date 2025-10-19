import { PartialType } from '@nestjs/mapped-types';
import { CreateProductOfferDto } from './create-product-offer.dto';

export class UpdateProductOfferDto extends PartialType(CreateProductOfferDto) {}
