import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthTokenPayload } from './auth.types';

export type AuthenticatedRequest = Request & {
  user?: AuthTokenPayload;
};

@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const payload = this.auth.verify(token);
    if (!payload) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    request.user = payload;
    return true;
  }
}
