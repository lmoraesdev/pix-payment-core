import { DomainError } from '@/shared/errors/domain.error';
import { ErrorCode } from '@/shared/errors/error-code.enum';

export class UnknownEventTypeError extends DomainError {
  constructor(readonly type: string) {
    super(`Unknown event type: "${type}"`, ErrorCode.UNKNOWN_EVENT_TYPE);
  }
}
