import { UserStatus } from 'apps/auth-service/generated/prisma';
import { IsString, IsMongoId, IsEnum } from 'class-validator';

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
  @IsEnum(UserStatus, {
    message: `Valid status are: ${JSON.stringify(Object.keys(UserStatus))}`,
  })
  newStatus: UserStatus;
}
