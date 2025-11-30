import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class UpdateClienInfo {
  /**
   * The unique identifier of the client whose status is to be updated.
   */
  @IsString()
  @IsMongoId()
  clientId: string;

  /**
   * The user ship address
   */
  @IsString()
  @IsOptional()
  address?: string;

  /**
   * The user full name.
   */
  @IsString()
  @IsOptional()
  fullName?: string;
}
