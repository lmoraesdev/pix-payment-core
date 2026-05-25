import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '@/shared/errors/domain.error';
import { AuthenticationError } from '@/shared/errors/authentication.error';
import { InvalidStateTransitionError } from '@/modules/charges/domain/charge-state-machine';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import { IdempotencyConflictError } from '@/modules/charges/domain/idempotency-conflict.error';
import { MissingIdempotencyKeyError } from '@/modules/charges/domain/missing-idempotency-key.error';
import { UnknownEventTypeError } from '@/modules/webhooks/domain/unknown-event-type.error';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

const STATUS_MAP = new Map<new (...args: never[]) => DomainError, HttpStatus>([
  [ChargeNotFoundError, HttpStatus.NOT_FOUND],
  [IdempotencyConflictError, HttpStatus.UNPROCESSABLE_ENTITY],
  [InvalidStateTransitionError, HttpStatus.CONFLICT],
  [MissingIdempotencyKeyError, HttpStatus.BAD_REQUEST],
  [UnknownEventTypeError, HttpStatus.UNPROCESSABLE_ENTITY],
  [AuthenticationError, HttpStatus.UNAUTHORIZED],
]);

@Catch(
  ChargeNotFoundError,
  IdempotencyConflictError,
  InvalidStateTransitionError,
  MissingIdempotencyKeyError,
  UnknownEventTypeError,
  AuthenticationError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger: StructuredLoggerService;

  constructor(logger: StructuredLoggerService) {
    this.logger = logger.forContext('DomainExceptionFilter');
  }

  catch(exception: DomainError, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();

    this.logger.warn({
      what: 'domain_error',
      why: exception.code,
      how: `${req.method} ${req.url}`,
      error_class: exception.constructor.name,
      message: exception.message,
    });

    const status = STATUS_MAP.get(exception.constructor as new (...args: never[]) => DomainError)!;

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, code: exception.code, message: exception.message });
  }
}
