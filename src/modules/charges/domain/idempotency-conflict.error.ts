import { DomainError } from '../../../shared/errors/domain.error';
import { ErrorCode } from '../../../shared/errors/error-code.enum';

export class IdempotencyConflictError extends DomainError {
  constructor(readonly key: string) {
    super(
      `Idempotency conflict: a different request body was already registered for key "${key}"`,
      ErrorCode.IDEMPOTENCY_CONFLICT,
    );
  }
}
