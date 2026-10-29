import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
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
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
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
