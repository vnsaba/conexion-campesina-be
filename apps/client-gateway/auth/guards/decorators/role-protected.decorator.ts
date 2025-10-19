import { SetMetadata } from '@nestjs/common';
import { ValidRoles } from '../../enum/valid-roles.enum';

export const ROLES_KEY = 'roles';

export const RoleProtected = (...args: ValidRoles[]) =>
  SetMetadata(ROLES_KEY, args);
