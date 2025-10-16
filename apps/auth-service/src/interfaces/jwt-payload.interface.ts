import { ValidRoles } from 'apps/auth-service/generated/prisma';

export interface JwtPayload {
  id: string;
  email: string;
  fullName: string;
  role: ValidRoles;
}
