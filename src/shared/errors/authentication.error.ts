import { DomainError } from './domain.error';
import { ErrorCode } from './error-code.enum';

export class AuthenticationError extends DomainError {
  constructor(reason: string) {
    super(reason, ErrorCode.AUTHENTICATION_FAILED);
  }
}
