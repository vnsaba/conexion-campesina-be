import { UserStatus } from 'apps/auth-service/generated/prisma';
import { IsEnum } from 'class-validator';
export class UpdateClientStatus {
  /**
   * The new status to set for the client.
   */
  @IsEnum(UserStatus, {
    message: `Valid status are: ${JSON.stringify(Object.keys(UserStatus))}`,
  })
  newStatus: UserStatus;
}
