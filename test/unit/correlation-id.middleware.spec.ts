import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
} from '@/shared/middleware/correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let req: { headers: Record<string, string> };
  let res: { setHeader: ReturnType<typeof vi.fn> };
  let next: NextFunction;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    req = { headers: {} };
    res = { setHeader: vi.fn() };
    next = vi.fn();
  });

  it('usa X-Correlation-Id do header se existir', () => {
    req.headers[CORRELATION_ID_HEADER] = 'existing-id';

    middleware.use(req as unknown as Request, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'existing-id');
  });

  it('gera novo correlation_id com prefixo req_ se header ausente', () => {
    middleware.use(req as unknown as Request, res as unknown as Response, next);

    const [, value] = res.setHeader.mock.calls[0] as [string, string];
    expect(value).toMatch(/^req_[0-9a-f-]{36}$/);
  });

  it('define X-Correlation-Id na response', () => {
    middleware.use(req as unknown as Request, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, expect.any(String));
  });

  it('chama next()', () => {
    middleware.use(req as unknown as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });
});
