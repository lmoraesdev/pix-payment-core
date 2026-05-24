import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import { IdempotencyConflictError } from '@/modules/charges/domain/idempotency-conflict.error';
import { MissingIdempotencyKeyError } from '@/modules/charges/domain/missing-idempotency-key.error';
import { InvalidStateTransitionError } from '@/modules/charges/domain/charge-state-machine';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { WebhookEventAlreadyProcessedError } from '@/modules/webhooks/domain/webhook-event-already-processed.error';
import { UnknownEventTypeError } from '@/modules/webhooks/domain/unknown-event-type.error';

describe('ErrorCode enum — valores prefixados', () => {
  it.each([
    [ErrorCode.CHARGE_NOT_FOUND, 'AE01'],
    [ErrorCode.IDEMPOTENCY_CONFLICT, 'AE02'],
    [ErrorCode.INVALID_STATE_TRANSITION, 'AE03'],
    [ErrorCode.WEBHOOK_EVENT_ALREADY_PROCESSED, 'AE04'],
    [ErrorCode.UNKNOWN_EVENT_TYPE, 'AE05'],
    [ErrorCode.MISSING_IDEMPOTENCY_KEY, 'AE06'],
    [ErrorCode.INTERNAL_ERROR, 'IE01'],
  ] as const)('%s === %s', (value, expected) => {
    expect(value).toBe(expected);
  });
});

describe('ChargeNotFoundError', () => {
  it('code é AE01', () => {
    expect(new ChargeNotFoundError('x').code).toBe('AE01');
  });
  it('carrega o id não encontrado', () => {
    expect(new ChargeNotFoundError('abc').id).toBe('abc');
  });
});

describe('IdempotencyConflictError', () => {
  it('code é AE02', () => {
    expect(new IdempotencyConflictError('k').code).toBe('AE02');
  });
  it('carrega a key conflitante', () => {
    expect(new IdempotencyConflictError('my-key').key).toBe('my-key');
  });
});

describe('InvalidStateTransitionError', () => {
  it('code é AE03', () => {
    const err = new InvalidStateTransitionError(ChargeStatus.PAID, ChargeStatus.EXPIRED);
    expect(err.code).toBe('AE03');
  });
});

describe('WebhookEventAlreadyProcessedError', () => {
  it('code é AE04', () => {
    expect(new WebhookEventAlreadyProcessedError('evt-1').code).toBe('AE04');
  });
  it('carrega o eventId', () => {
    expect(new WebhookEventAlreadyProcessedError('evt-1').eventId).toBe('evt-1');
  });
});

describe('UnknownEventTypeError', () => {
  it('code é AE05', () => {
    expect(new UnknownEventTypeError('payment.refunded').code).toBe('AE05');
  });
  it('carrega o type desconhecido', () => {
    expect(new UnknownEventTypeError('payment.refunded').type).toBe('payment.refunded');
  });
  it('mensagem inclui o type', () => {
    expect(new UnknownEventTypeError('payment.refunded').message).toContain('payment.refunded');
  });
});

describe('MissingIdempotencyKeyError', () => {
  it('code é AE06', () => {
    expect(new MissingIdempotencyKeyError().code).toBe('AE06');
  });
  it('mensagem descreve o header ausente', () => {
    expect(new MissingIdempotencyKeyError().message).toContain('Idempotency-Key');
  });
});
