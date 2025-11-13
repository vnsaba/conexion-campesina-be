import { IsBoolean } from 'class-validator';
export class UpdateClientStatus {
  /**
   * The new status to set for the client.
   */
  @IsBoolean()
  active: boolean;
}
