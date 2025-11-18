import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateInventoryDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  available_quantity?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minimum_threshold?: number;
}
