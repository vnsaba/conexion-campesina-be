import { IsBoolean, IsString, IsMongoId } from 'class-validator';

export class UpdateClientStatus {
  /**
   * The unique identifier of the client whose status is to be updated.
   */
  @IsString()
  @IsMongoId()
  clientId: string;

  /**
   * The new status to set for the client.
   */
  @IsBoolean()
  active: boolean;
}
