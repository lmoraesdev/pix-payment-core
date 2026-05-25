import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import { IdempotencyConflictError } from '@/modules/charges/domain/idempotency-conflict.error';
import { MissingIdempotencyKeyError } from '@/modules/charges/domain/missing-idempotency-key.error';
import { InvalidStateTransitionError } from '@/modules/charges/domain/charge-state-machine';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { WebhookEventAlreadyProcessedError } from '@/modules/webhooks/domain/webhook-event-already-processed.error';
import { UnknownEventTypeError } from '@/modules/webhooks/domain/unknown-event-type.error';
import { AuthenticationError } from '@/shared/errors/authentication.error';

// ─── ErrorCode enum ───────────────────────────────────────────────────────────

describe('ErrorCode enum — valores prefixados', () => {
  it.each([
    [ErrorCode.CHARGE_NOT_FOUND, 'AE01'],
    [ErrorCode.IDEMPOTENCY_CONFLICT, 'AE02'],
    [ErrorCode.INVALID_STATE_TRANSITION, 'AE03'],
    [ErrorCode.WEBHOOK_EVENT_ALREADY_PROCESSED, 'AE04'],
    [ErrorCode.UNKNOWN_EVENT_TYPE, 'AE05'],
    [ErrorCode.MISSING_IDEMPOTENCY_KEY, 'AE06'],
    [ErrorCode.INTERNAL_ERROR, 'IE01'],
    [ErrorCode.VALIDATION_ERROR, 'VE01'],
    [ErrorCode.AUTHENTICATION_FAILED, 'SE01'],
  ] as const)('%s === %s', (errorCode, expectedRawValue) => {
    expect(errorCode).toBe(expectedRawValue);
  });
});

// ─── ChargeNotFoundError ──────────────────────────────────────────────────────

describe('ChargeNotFoundError', () => {
  it('code é CHARGE_NOT_FOUND', () => {
    expect(new ChargeNotFoundError('x').code).toBe(ErrorCode.CHARGE_NOT_FOUND);
  });
  it('carrega o id não encontrado', () => {
    expect(new ChargeNotFoundError('abc').id).toBe('abc');
  });
});

// ─── IdempotencyConflictError ─────────────────────────────────────────────────

describe('IdempotencyConflictError', () => {
  it('code é IDEMPOTENCY_CONFLICT', () => {
    expect(new IdempotencyConflictError('k').code).toBe(ErrorCode.IDEMPOTENCY_CONFLICT);
  });
  it('carrega a key conflitante', () => {
    expect(new IdempotencyConflictError('my-key').key).toBe('my-key');
  });
});

// ─── InvalidStateTransitionError ─────────────────────────────────────────────

describe('InvalidStateTransitionError', () => {
  it('code é INVALID_STATE_TRANSITION', () => {
    const error = new InvalidStateTransitionError(ChargeStatus.PAID, ChargeStatus.EXPIRED);
    expect(error.code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
  });
});

// ─── WebhookEventAlreadyProcessedError ───────────────────────────────────────

describe('WebhookEventAlreadyProcessedError', () => {
  it('code é WEBHOOK_EVENT_ALREADY_PROCESSED', () => {
    expect(new WebhookEventAlreadyProcessedError('evt-1').code).toBe(
      ErrorCode.WEBHOOK_EVENT_ALREADY_PROCESSED,
    );
  });
  it('carrega o eventId', () => {
    expect(new WebhookEventAlreadyProcessedError('evt-1').eventId).toBe('evt-1');
  });
});

// ─── UnknownEventTypeError ────────────────────────────────────────────────────

describe('UnknownEventTypeError', () => {
  it('code é UNKNOWN_EVENT_TYPE', () => {
    expect(new UnknownEventTypeError('payment.refunded').code).toBe(ErrorCode.UNKNOWN_EVENT_TYPE);
  });
  it('carrega o type desconhecido', () => {
    expect(new UnknownEventTypeError('payment.refunded').type).toBe('payment.refunded');
  });
  it('mensagem inclui o type', () => {
    expect(new UnknownEventTypeError('payment.refunded').message).toContain('payment.refunded');
  });
});

// ─── MissingIdempotencyKeyError ───────────────────────────────────────────────

describe('MissingIdempotencyKeyError', () => {
  it('code é MISSING_IDEMPOTENCY_KEY', () => {
    expect(new MissingIdempotencyKeyError().code).toBe(ErrorCode.MISSING_IDEMPOTENCY_KEY);
  });
  it('mensagem descreve o header ausente', () => {
    expect(new MissingIdempotencyKeyError().message).toContain('Idempotency-Key');
  });
});

// ─── AuthenticationError ──────────────────────────────────────────────────────

describe('AuthenticationError', () => {
  it('code é AUTHENTICATION_FAILED', () => {
    expect(new AuthenticationError('invalid token').code).toBe(ErrorCode.AUTHENTICATION_FAILED);
  });
  it('mensagem é o reason fornecido', () => {
    expect(new AuthenticationError('invalid token').message).toBe('invalid token');
  });
});
