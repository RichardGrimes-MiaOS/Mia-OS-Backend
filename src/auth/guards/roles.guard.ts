import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log('[RolesGuard] Required roles:', requiredRoles);

    if (!requiredRoles) {
      console.log('[RolesGuard] No required roles, allowing access');
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    console.log('[RolesGuard] User from request:', user);

    if (!user) {
      console.log('[RolesGuard] No user found in request, denying access');
      return false;
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    console.log('[RolesGuard] User role:', user.role, '| Has required role:', hasRole);

    return hasRole;
  }
}