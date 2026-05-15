import { DomainError } from '../../../shared/errors/domain.error';
import { ErrorCode } from '../../../shared/errors/error-code.enum';

export class ChargeNotFoundError extends DomainError {
  constructor(readonly id: string) {
    super(`Charge not found: "${id}"`, ErrorCode.CHARGE_NOT_FOUND);
  }
}
