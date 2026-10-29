import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import type { AuthTokenPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  login(
    username: string,
    password: string,
  ): { token: string; expiresAt: string } | null {
    const expectedUser = this.config.get('OPERATOR_USERNAME', { infer: true });
    const expectedPass = this.config.get('OPERATOR_PASSWORD', { infer: true });

    if (
      !this.safeEqualStrings(username, expectedUser) ||
      !this.safeEqualStrings(password, expectedPass)
    ) {
      return null;
    }

    const ttlHours = this.config.get('AUTH_TOKEN_TTL_HOURS', { infer: true });
    const exp = Math.floor(Date.now() / 1000) + ttlHours * 3600;
    const payload: AuthTokenPayload = { sub: expectedUser, exp };
    const token = this.sign(payload);

    return {
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  verify(token: string): AuthTokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [bodyB64, sigB64] = parts;
    if (!bodyB64 || !sigB64) {
      return null;
    }

    const expectedSig = this.hmac(bodyB64);
    if (!this.safeEqualStrings(sigB64, expectedSig)) {
      return null;
    }

    let payload: AuthTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(bodyB64, 'base64url').toString('utf8'),
      ) as AuthTokenPayload;
    } catch {
      return null;
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp)
    ) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  }

  private sign(payload: AuthTokenPayload): string {
    const bodyB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const sigB64 = this.hmac(bodyB64);
    return `${bodyB64}.${sigB64}`;
  }

  private hmac(bodyB64: string): string {
    return createHmac('sha256', this.tokenSecret())
      .update(bodyB64)
      .digest('base64url');
  }

  private tokenSecret(): string {
    const explicit = this.config.get('AUTH_TOKEN_SECRET', { infer: true });
    if (explicit) {
      return explicit;
    }
    const webhook = this.config.get('TELEGRAM_WEBHOOK_SECRET', {
      infer: true,
    });
    if (webhook) {
      return webhook;
    }
    return this.config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
  }

  private safeEqualStrings(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    const len = Math.max(aBuf.length, bBuf.length, 1);
    const aPad = Buffer.alloc(len);
    const bPad = Buffer.alloc(len);
    aBuf.copy(aPad);
    bBuf.copy(bPad);
    const equal = timingSafeEqual(aPad, bPad);
    return equal && aBuf.length === bBuf.length;
  }
}
