import { ChargeStatus } from './charge-status.enum';

export class InvalidStateTransitionError extends Error {
  constructor(from: ChargeStatus, to: ChargeStatus) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class ChargeStateMachine {
  constructor(private readonly current: ChargeStatus) {}

  transitionTo(_next: ChargeStatus): ChargeStatus {
    throw new Error('Not implemented');
  }
}
