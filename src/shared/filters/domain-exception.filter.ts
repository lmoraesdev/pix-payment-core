import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { InvalidStateTransitionError } from '../../modules/charges/domain/charge-state-machine';
import { ChargeNotFoundError } from '../../modules/charges/domain/charge-not-found.error';
import { IdempotencyConflictError } from '../../modules/charges/domain/idempotency-conflict.error';

type DomainError =
  | ChargeNotFoundError
  | IdempotencyConflictError
  | InvalidStateTransitionError;

const STATUS_MAP = new Map<new (...args: never[]) => DomainError, HttpStatus>([
  [ChargeNotFoundError, HttpStatus.NOT_FOUND],
  [IdempotencyConflictError, HttpStatus.UNPROCESSABLE_ENTITY],
  [InvalidStateTransitionError, HttpStatus.CONFLICT],
]);

@Catch(ChargeNotFoundError, IdempotencyConflictError, InvalidStateTransitionError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const status = STATUS_MAP.get(
      exception.constructor as new (...args: never[]) => DomainError,
    )!;

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: exception.message });
  }
}
