import { DomainError } from '../../../shared/errors/domain.error';
import { ErrorCode } from '../../../shared/errors/error-code.enum';
import { ChargeStatus } from './charge-status.enum';

const VALID_TRANSITIONS: Partial<Record<ChargeStatus, ChargeStatus[]>> = {
  [ChargeStatus.CREATED]: [ChargeStatus.AWAITING_PAYMENT],
  [ChargeStatus.AWAITING_PAYMENT]: [ChargeStatus.PAID, ChargeStatus.EXPIRED],
};

export class InvalidStateTransitionError extends DomainError {
  constructor(from: ChargeStatus, to: ChargeStatus) {
    super(`Invalid transition: ${from} → ${to}`, ErrorCode.INVALID_STATE_TRANSITION);
  }
}

export class ChargeStateMachine {
  constructor(private readonly current: ChargeStatus) {}

  transitionTo(next: ChargeStatus): ChargeStatus {
    const allowed = VALID_TRANSITIONS[this.current];
    if (!allowed?.includes(next)) {
      throw new InvalidStateTransitionError(this.current, next);
    }
    return next;
  }
}
