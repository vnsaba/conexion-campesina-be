import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ValidRoles } from '../enum/valid-roles.enum';
import { Observable } from 'rxjs';
import { ROLES_KEY } from './decorators';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  // Reflector is used to access metadata set by decorators

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ValidRoles[]>(
      ROLES_KEY, //
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { role: ValidRoles } }>();

    const user = req.user;

    if (!user) throw new BadRequestException('User not found in request');

    return requiredRoles.includes(user.role);
  }
}
