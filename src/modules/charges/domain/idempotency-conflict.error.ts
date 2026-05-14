export class IdempotencyConflictError extends Error {
  constructor(readonly key: string) {
    super(
      `Idempotency conflict: a different request body was already registered for key "${key}"`,
    );
    this.name = 'IdempotencyConflictError';
  }
}
