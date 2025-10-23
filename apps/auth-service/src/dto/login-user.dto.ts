import { IsEmail, IsString, IsStrongPassword } from 'class-validator';
export class LoginUserDto {
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
}
