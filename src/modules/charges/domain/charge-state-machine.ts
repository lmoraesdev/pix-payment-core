import { ChargeStatus } from './charge-status.enum';

const VALID_TRANSITIONS: Partial<Record<ChargeStatus, ChargeStatus[]>> = {
  [ChargeStatus.CREATED]: [ChargeStatus.AWAITING_PAYMENT],
  [ChargeStatus.AWAITING_PAYMENT]: [ChargeStatus.PAID, ChargeStatus.EXPIRED],
};

export class InvalidStateTransitionError extends Error {
  constructor(from: ChargeStatus, to: ChargeStatus) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'InvalidStateTransitionError';
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
