import { IsString, IsOptional } from 'class-validator';

export class UpdateClienInfo {
  /**
   * The user ship address
   */
  @IsString()
  @IsOptional()
  address: string;

  /**
   * The user full name.
   */
  @IsString()
  @IsOptional()
  fullName: string;
}
