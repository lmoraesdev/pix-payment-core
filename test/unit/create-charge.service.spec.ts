import { describe, it } from 'vitest';

describe('CreateChargeService', () => {
  it.todo('creates charge and persists idempotency key when key is new');
  it.todo('returns cached ChargeResponseDto when key exists and hash matches');
  it.todo('throws UnprocessableEntityException when key exists but hash differs');
});
