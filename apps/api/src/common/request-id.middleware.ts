import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

const logger = new Logger('HTTP');

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header('x-request-id')?.trim();
  const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  const started = Date.now();
  res.on('finish', () => {
    logger.log(
      `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode} ${Date.now() - started}ms requestId=${requestId}`,
    );
  });

  next();
}
