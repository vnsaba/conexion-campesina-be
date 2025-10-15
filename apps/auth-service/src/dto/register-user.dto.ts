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
  @IsString()
  @MinLength(5)
  fullName: string;

  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @IsEnum(ValidRoles, { message: "El rol debe ser 'PRODUCER' o 'CLIENT'" })
  @NotEquals(ValidRoles.ADMIN, {
    message: 'No se puede registrar como administrador',
  })
  role: ValidRoles;
}
