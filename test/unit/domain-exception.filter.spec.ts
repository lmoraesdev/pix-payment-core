import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { DomainExceptionFilter } from '@/shared/filters/domain-exception.filter';
import { DomainError } from '@/shared/errors/domain.error';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import { IdempotencyConflictError } from '@/modules/charges/domain/idempotency-conflict.error';
import { MissingIdempotencyKeyError } from '@/modules/charges/domain/missing-idempotency-key.error';
import { InvalidStateTransitionError } from '@/modules/charges/domain/charge-state-machine';
import { UnknownEventTypeError } from '@/modules/webhooks/domain/unknown-event-type.error';
import { AuthenticationError } from '@/shared/errors/authentication.error';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import { createMockLogger } from '@test/fakes';

// ─── Host mock factory ────────────────────────────────────────────────────────

function makeHost(jsonSpy = vi.fn()) {
  const response = { status: vi.fn().mockReturnValue({ json: jsonSpy }) };
  const request = { method: 'GET', url: '/charges/abc' };
  return {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    response,
    jsonSpy,
  };
}

// ─── Test Table ───────────────────────────────────────────────────────────────

interface FilterRow {
  exceptionLabel: string;
  exception: DomainError;
  expectedStatus: HttpStatus;
  expectedCode: ErrorCode;
}

const filterRows: FilterRow[] = [
  {
    exceptionLabel: 'ChargeNotFoundError',
    exception: new ChargeNotFoundError('id-1'),
    expectedStatus: HttpStatus.NOT_FOUND,
    expectedCode: ErrorCode.CHARGE_NOT_FOUND,
  },
  {
    exceptionLabel: 'IdempotencyConflictError',
    exception: new IdempotencyConflictError('key-1'),
    expectedStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    expectedCode: ErrorCode.IDEMPOTENCY_CONFLICT,
  },
  {
    exceptionLabel: 'InvalidStateTransitionError',
    exception: new InvalidStateTransitionError(ChargeStatus.PAID, ChargeStatus.EXPIRED),
    expectedStatus: HttpStatus.CONFLICT,
    expectedCode: ErrorCode.INVALID_STATE_TRANSITION,
  },
  {
    exceptionLabel: 'MissingIdempotencyKeyError',
    exception: new MissingIdempotencyKeyError(),
    expectedStatus: HttpStatus.BAD_REQUEST,
    expectedCode: ErrorCode.MISSING_IDEMPOTENCY_KEY,
  },
  {
    exceptionLabel: 'UnknownEventTypeError',
    exception: new UnknownEventTypeError('payment.refunded'),
    expectedStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    expectedCode: ErrorCode.UNKNOWN_EVENT_TYPE,
  },
  {
    exceptionLabel: 'AuthenticationError',
    exception: new AuthenticationError('invalid token'),
    expectedStatus: HttpStatus.UNAUTHORIZED,
    expectedCode: ErrorCode.AUTHENTICATION_FAILED,
  },
];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    filter = new DomainExceptionFilter(mockLogger);
  });

  it.each(filterRows)(
    '$exceptionLabel → HTTP $expectedStatus, código $expectedCode, log estruturado',
    ({ exception, expectedStatus, expectedCode }) => {
      const jsonSpy = vi.fn();
      const host = makeHost(jsonSpy);

      filter.catch(exception, host as never);

      expect(host.response.status).toHaveBeenCalledWith(expectedStatus);

      expect(jsonSpy).toHaveBeenCalledWith({
        statusCode: expectedStatus,
        code: expectedCode,
        message: exception.message,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          what: 'domain_error',
          why: expectedCode,
          error_class: exception.constructor.name,
          how: 'GET /charges/abc',
        }),
      );
    },
  );
});
