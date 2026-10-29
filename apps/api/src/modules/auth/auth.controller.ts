import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { InMemoryRateLimiter } from '../../common/in-memory-rate-limiter';
import { AuthService } from './auth.service';
import {
  OperatorAuthGuard,
  type AuthenticatedRequest,
} from './operator-auth.guard';

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  /** 5 intentos por IP cada 5 minutos. */
  private readonly loginLimiter = new InMemoryRateLimiter(5, 5 * 60_000);

  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: unknown, @Req() req: Request) {
    const ip = clientIp(req);
    if (!this.loginLimiter.tryConsume(ip)) {
      throw new HttpException(
        'Demasiados intentos, espera unos minutos',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        'Body inválido: se requiere { username, password }',
      );
    }

    const result = this.auth.login(
      parsed.data.username,
      parsed.data.password,
    );
    if (!result) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    return {
      token: result.token,
      expiresAt: result.expiresAt,
      username: parsed.data.username,
    };
  }

  @Get('me')
  @UseGuards(OperatorAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return { username: req.user!.sub };
  }
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}
