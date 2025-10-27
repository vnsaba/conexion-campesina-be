import {
  IsEmail,
  IsEnum,
  IsString,
  IsStrongPassword,
  MinLength,
  NotEquals,
} from 'class-validator';
import { ValidRoles } from '../../generated/prisma';
export class RegisterUserDto {
  /**
   * User's full name.
   */
  @IsString()
  @MinLength(5)
  fullName: string;

  /**
   * User's valid email address.
   */
  @IsString()
  @IsEmail()
  email: string;

  /**
   * Secure password containing uppercase, lowercase, numbers, and symbols.
   */
  @IsString()
  @IsStrongPassword()
  password: string;

  /**
   * User role within the system.
   * Must be either 'PRODUCER' or 'CLIENT'.
   * @example "PRODUCER"
   */
  @IsEnum(ValidRoles, { message: "Role must be 'PRODUCER' or 'CLIENT'" })
  @NotEquals(ValidRoles.ADMIN, {
    message: 'Cannot register as administrator',
  })
  role: ValidRoles;
}
