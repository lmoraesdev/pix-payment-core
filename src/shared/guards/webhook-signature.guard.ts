import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.headers['x-webhook-signature'];
    const secret = process.env['WEBHOOK_SECRET'];

    if (typeof signature !== 'string' || !secret) {
      throw new UnauthorizedException();
    }

    const expected = createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    if (
      sigBuf.length !== expBuf.length ||
      !timingSafeEqual(sigBuf, expBuf)
    ) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
