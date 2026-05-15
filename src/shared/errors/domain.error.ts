import { ErrorCode } from './error-code.enum';

export abstract class DomainError extends Error {
  readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
  }
}
