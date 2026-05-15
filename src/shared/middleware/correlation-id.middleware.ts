import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { correlationIdStorage } from '@/shared/logger/correlation-id.storage';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.headers[CORRELATION_ID_HEADER] as string | undefined;
    const correlationId = existing ?? `req_${uuidv4()}`;

    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    correlationIdStorage.run({ correlationId }, () => next());
  }
}
