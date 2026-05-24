import { DomainError } from '@/shared/errors/domain.error';
import { ErrorCode } from '@/shared/errors/error-code.enum';

export class MissingIdempotencyKeyError extends DomainError {
  constructor() {
    super('Idempotency-Key header is required', ErrorCode.MISSING_IDEMPOTENCY_KEY);
  }
}
