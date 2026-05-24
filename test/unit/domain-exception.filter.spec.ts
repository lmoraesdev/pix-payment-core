import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { DomainExceptionFilter } from '@/shared/filters/domain-exception.filter';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import { IdempotencyConflictError } from '@/modules/charges/domain/idempotency-conflict.error';
import { MissingIdempotencyKeyError } from '@/modules/charges/domain/missing-idempotency-key.error';
import { InvalidStateTransitionError } from '@/modules/charges/domain/charge-state-machine';
import { UnknownEventTypeError } from '@/modules/webhooks/domain/unknown-event-type.error';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import type { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

const mockLogger = {
  forContext: vi.fn().mockReturnThis(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeHost(statusFn = vi.fn(), jsonFn = vi.fn()) {
  const res = { status: vi.fn().mockReturnValue({ json: jsonFn }) };
  const req = { method: 'GET', url: '/charges/abc' };
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
    res,
    json: jsonFn,
    statusFn,
  };
}

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new DomainExceptionFilter(mockLogger as unknown as StructuredLoggerService);
  });

  describe('mapeamento de status HTTP', () => {
    it.each([
      [new ChargeNotFoundError('id-1'), HttpStatus.NOT_FOUND],
      [new IdempotencyConflictError('key-1'), HttpStatus.UNPROCESSABLE_ENTITY],
      [new InvalidStateTransitionError(ChargeStatus.PAID, ChargeStatus.EXPIRED), HttpStatus.CONFLICT],
      [new MissingIdempotencyKeyError(), HttpStatus.BAD_REQUEST],
      [new UnknownEventTypeError('x'), HttpStatus.UNPROCESSABLE_ENTITY],
    ] as const)('%s retorna status correto', (exception, expectedStatus) => {
      const host = makeHost();
      filter.catch(exception, host as never);
      expect(host.res.status).toHaveBeenCalledWith(expectedStatus);
    });
  });

  describe('envelope de resposta', () => {
    it('inclui statusCode, code e message', () => {
      const exception = new ChargeNotFoundError('id-1');
      const host = makeHost();
      filter.catch(exception, host as never);
      expect(host.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'AE01',
        message: exception.message,
      });
    });
  });

  describe('log estruturado', () => {
    it('chama logger.warn com what=domain_error para cada erro capturado', () => {
      const exception = new ChargeNotFoundError('id-1');
      const host = makeHost();
      filter.catch(exception, host as never);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          what: 'domain_error',
          why: 'AE01',
          error_class: 'ChargeNotFoundError',
        }),
      );
    });

    it('inclui method + url no campo how', () => {
      const exception = new MissingIdempotencyKeyError();
      const host = makeHost();
      filter.catch(exception, host as never);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ how: 'GET /charges/abc' }),
      );
    });
  });
});
