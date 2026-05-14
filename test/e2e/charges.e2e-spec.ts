import { describe, it } from 'vitest';

describe('POST /charges (e2e)', () => {
  it.todo('returns 201 with charge in AWAITING_PAYMENT status');
  it.todo('returns 200 with original response on duplicate Idempotency-Key + same body');
  it.todo('returns 422 on duplicate Idempotency-Key with different body');
  it.todo('returns 400 when Idempotency-Key header is missing');
});

describe('GET /charges/:id (e2e)', () => {
  it.todo('returns charge by id');
  it.todo('returns 404 when charge does not exist');
});

describe('POST /webhooks/provider (e2e)', () => {
  it.todo('transitions charge to PAID on payment.confirmed event');
  it.todo('transitions charge to EXPIRED on payment.expired event');
  it.todo('returns 200 without reprocessing on duplicate event_id');
});
