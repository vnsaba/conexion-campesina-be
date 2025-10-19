import { SetMetadata } from '@nestjs/common';

export type AppRole = 'ADMIN' | 'PRODUCER' | 'BUYER';
export const ROLES_KEY = 'roles';

/**
 * Attaches required roles metadata to a route handler or controller
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
