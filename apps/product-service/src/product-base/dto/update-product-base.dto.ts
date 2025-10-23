import { PartialType } from '@nestjs/mapped-types';
import { CreateProductBaseDto } from './create-product-base.dto';

export class UpdateProductBaseDto extends PartialType(CreateProductBaseDto) {}
