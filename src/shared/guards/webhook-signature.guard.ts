import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

    const signature = req.headers['x-webhook-signature'];
    const secret = process.env['WEBHOOK_SECRET'];
    const rawBody = req.rawBody;

    if (typeof signature !== 'string' || !secret) {
      throw new UnauthorizedException();
    }

    if (!rawBody || rawBody.length === 0) {
      throw new UnauthorizedException(
        'Missing raw body — ensure rawBody: true is set in NestFactory.create',
      );
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
