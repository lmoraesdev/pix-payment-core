import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessWebhookService } from '@/modules/webhooks/application/process-webhook.service';
import type { StructuredLoggerService } from '@/shared/logger/structured-logger.service';
import { WebhookEventAlreadyProcessedError } from '@/modules/webhooks/domain/webhook-event-already-processed.error';
import { UnknownEventTypeError } from '@/modules/webhooks/domain/unknown-event-type.error';
import { InvalidStateTransitionError } from '@/modules/charges/domain/charge-state-machine';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import type { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import type { WebhookEventRepository } from '@/modules/webhooks/infrastructure/webhook-event.repository';
import type { TransactionRunner } from '@/shared/database/transaction-runner';
import type { Charge } from '@/modules/charges/domain/charge.entity';
import { runTests, setupStubs, assertStubs, getError } from '@test/helpers';
import type { TestCase, StubConfig, CallMatchConfig } from '@test/helpers';
import { aCharge, aWebhookEvent } from '@test/builders';
import { createMockLogger } from '@test/fakes';

// ─── Tipos do Test Table ──────────────────────────────────────────────────────

interface Input {
  event: ReturnType<typeof aWebhookEvent.prototype.build>;
  stubs: {
    chargeRepo: Partial<Record<'findByIdForUpdate' | 'save', StubConfig>>;
    webhookEventRepo: Partial<Record<'markAsProcessed', StubConfig>>;
  };
}

interface Output {
  error: boolean;
  errorClass?: new (...args: never[]) => Error;
  expectedStatus?: ChargeStatus;
  stubs: {
    chargeRepo: Partial<Record<'findByIdForUpdate' | 'save', CallMatchConfig>>;
    webhookEventRepo: Partial<Record<'markAsProcessed', CallMatchConfig>>;
  };
  logs?: { method: 'log' | 'warn' | 'error'; what: string };
}

// ─── Dados por caso — instâncias separadas para evitar mutação cruzada ────────
//
// Cada caso de sucesso chama charge.transitionTo(), que muta o status in-place.
// Compartilhar a mesma instância entre casos causaria falha no segundo teste.

const chargeForConfirmed = aCharge().awaitingPayment().build();
const chargeForExpired = aCharge().awaitingPayment().build();
const chargeForUnknownType = aCharge().awaitingPayment().build();
const paidCharge = aCharge().paid().build();

// ─── Test Cases ───────────────────────────────────────────────────────────────

const testCases: Array<TestCase<Input, Output>> = [
  {
    name: 'payment.confirmed + AWAITING_PAYMENT → charge fica PAID',
    input: {
      event: aWebhookEvent().confirmed().withChargeId(chargeForConfirmed.id).build(),
      stubs: {
        webhookEventRepo: { markAsProcessed: { resolves: undefined } },
        chargeRepo: {
          findByIdForUpdate: { resolves: chargeForConfirmed },
          save: { resolves: chargeForConfirmed },
        },
      },
    },
    output: {
      error: false,
      expectedStatus: ChargeStatus.PAID,
      stubs: {
        chargeRepo: { findByIdForUpdate: { called: true }, save: { called: true } },
        webhookEventRepo: { markAsProcessed: { called: true } },
      },
      logs: { method: 'log', what: 'charge_state_transitioned' },
    },
  },
  {
    name: 'payment.expired + AWAITING_PAYMENT → charge fica EXPIRED',
    input: {
      event: aWebhookEvent().expired().withChargeId(chargeForExpired.id).build(),
      stubs: {
        webhookEventRepo: { markAsProcessed: { resolves: undefined } },
        chargeRepo: {
          findByIdForUpdate: { resolves: chargeForExpired },
          save: { resolves: chargeForExpired },
        },
      },
    },
    output: {
      error: false,
      expectedStatus: ChargeStatus.EXPIRED,
      stubs: {
        chargeRepo: { findByIdForUpdate: { called: true }, save: { called: true } },
        webhookEventRepo: { markAsProcessed: { called: true } },
      },
    },
  },
  {
    name: 'evento duplicado → retorna sem efeito, não busca nem salva charge',
    input: {
      event: aWebhookEvent().build(),
      stubs: {
        webhookEventRepo: {
          markAsProcessed: {
            resolves: new WebhookEventAlreadyProcessedError('evt-dup'),
            error: true,
          },
        },
        chargeRepo: {},
      },
    },
    output: {
      error: false,
      stubs: {
        chargeRepo: { findByIdForUpdate: { notCalled: true }, save: { notCalled: true } },
        webhookEventRepo: { markAsProcessed: { called: true } },
      },
      logs: { method: 'log', what: 'webhook_already_processed' },
    },
  },
  {
    name: 'charge_id inexistente → lança ChargeNotFoundError',
    input: {
      event: aWebhookEvent().confirmed().build(),
      stubs: {
        webhookEventRepo: { markAsProcessed: { resolves: undefined } },
        chargeRepo: { findByIdForUpdate: { resolves: null } },
      },
    },
    output: {
      error: true,
      errorClass: ChargeNotFoundError,
      stubs: {
        chargeRepo: { findByIdForUpdate: { called: true }, save: { notCalled: true } },
        webhookEventRepo: { markAsProcessed: { called: true } },
      },
    },
  },
  {
    name: 'tipo de evento desconhecido → lança UnknownEventTypeError',
    input: {
      event: aWebhookEvent()
        .withType('payment.refunded' as never)
        .withChargeId(chargeForUnknownType.id)
        .build(),
      stubs: {
        webhookEventRepo: { markAsProcessed: { resolves: undefined } },
        chargeRepo: { findByIdForUpdate: { resolves: chargeForUnknownType } },
      },
    },
    output: {
      error: true,
      errorClass: UnknownEventTypeError,
      stubs: {
        chargeRepo: { findByIdForUpdate: { called: true }, save: { notCalled: true } },
        webhookEventRepo: { markAsProcessed: { called: true } },
      },
    },
  },
  {
    name: 'transição inválida (charge PAID + payment.expired) → lança InvalidStateTransitionError, não salva',
    input: {
      event: aWebhookEvent().expired().withChargeId(paidCharge.id).build(),
      stubs: {
        webhookEventRepo: { markAsProcessed: { resolves: undefined } },
        chargeRepo: { findByIdForUpdate: { resolves: paidCharge } },
      },
    },
    output: {
      error: true,
      errorClass: InvalidStateTransitionError,
      stubs: {
        chargeRepo: { findByIdForUpdate: { called: true }, save: { notCalled: true } },
        webhookEventRepo: { markAsProcessed: { called: true } },
      },
    },
  },
];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ProcessWebhookService', () => {
  let service: ProcessWebhookService;
  let chargeRepo: {
    findByIdForUpdate: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let webhookEventRepo: { markAsProcessed: ReturnType<typeof vi.fn> };
  let transactionRunner: { run: ReturnType<typeof vi.fn> };
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    chargeRepo = { findByIdForUpdate: vi.fn(), save: vi.fn() };
    webhookEventRepo = { markAsProcessed: vi.fn() };
    transactionRunner = { run: vi.fn((work: (manager: undefined) => unknown) => work(undefined)) };
    mockLogger = createMockLogger();
    service = new ProcessWebhookService(
      chargeRepo as unknown as ChargeRepository,
      webhookEventRepo as unknown as WebhookEventRepository,
      transactionRunner as unknown as TransactionRunner,
      mockLogger as unknown as StructuredLoggerService,
    );
  });

  runTests(testCases, async (_name, { input, output }) => {
    setupStubs(chargeRepo, input.stubs.chargeRepo);
    setupStubs(webhookEventRepo, input.stubs.webhookEventRepo);
    chargeRepo.save.mockImplementation(async (charge: Charge) => charge);

    if (output.error) {
      const error = await getError(() => service.execute(input.event));
      if (output.errorClass) expect(error).toBeInstanceOf(output.errorClass);
    } else {
      await service.execute(input.event);
      if (output.expectedStatus !== undefined) {
        const [savedCharge] = chargeRepo.save.mock.calls[0] as [Charge];
        expect(savedCharge.status).toBe(output.expectedStatus);
      }
    }

    assertStubs('chargeRepo', chargeRepo, output.stubs.chargeRepo);
    assertStubs('webhookEventRepo', webhookEventRepo, output.stubs.webhookEventRepo);

    if (output.logs) {
      expect(mockLogger[output.logs.method]).toHaveBeenCalledWith(
        expect.objectContaining({ what: output.logs.what }),
      );
    }
  });

  // ─── Tabela de decisão: evento × estado da charge ─────────────────────────

  describe('tabela de decisão — evento × estado da charge', () => {
    const matrix = [
      { status: ChargeStatus.AWAITING_PAYMENT, event: 'payment.confirmed' as const, expected: ChargeStatus.PAID,    ok: true  },
      { status: ChargeStatus.AWAITING_PAYMENT, event: 'payment.expired'   as const, expected: ChargeStatus.EXPIRED, ok: true  },
      { status: ChargeStatus.PAID,             event: 'payment.confirmed' as const, expected: null,                 ok: false },
      { status: ChargeStatus.PAID,             event: 'payment.expired'   as const, expected: null,                 ok: false },
      { status: ChargeStatus.EXPIRED,          event: 'payment.confirmed' as const, expected: null,                 ok: false },
      { status: ChargeStatus.EXPIRED,          event: 'payment.expired'   as const, expected: null,                 ok: false },
      { status: ChargeStatus.CREATED,          event: 'payment.confirmed' as const, expected: null,                 ok: false },
      { status: ChargeStatus.CREATED,          event: 'payment.expired'   as const, expected: null,                 ok: false },
    ];

    it.each(matrix)(
      'charge $status + $event → sucesso: $ok',
      async ({ status, event, expected, ok }) => {
        const charge = aCharge().withStatus(status).build();
        const webhookEvent = aWebhookEvent().withType(event).withChargeId(charge.id).build();

        webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
        chargeRepo.findByIdForUpdate.mockResolvedValue(charge);
        chargeRepo.save.mockImplementation(async (savedCharge: Charge) => savedCharge);

        if (ok) {
          await service.execute(webhookEvent);
          const [savedCharge] = chargeRepo.save.mock.calls[0] as [Charge];
          expect(savedCharge.status).toBe(expected);
        } else {
          await expect(service.execute(webhookEvent)).rejects.toThrow(InvalidStateTransitionError);
          expect(chargeRepo.save).not.toHaveBeenCalled();
        }
      },
    );
  });

  describe('atomicidade da transação', () => {
    it('markAsProcessed, findByIdForUpdate e save acontecem dentro da mesma transação', async () => {
      const charge = aCharge().awaitingPayment().build();
      const webhookEvent = aWebhookEvent().confirmed().withChargeId(charge.id).build();

      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findByIdForUpdate.mockResolvedValue(charge);
      chargeRepo.save.mockImplementation(async (savedCharge: Charge) => savedCharge);

      await service.execute(webhookEvent);

      expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    });

    it('erro ao salvar a charge propaga para fora da transação (rollback fica a cargo do Postgres)', async () => {
      const charge = aCharge().awaitingPayment().build();
      const webhookEvent = aWebhookEvent().confirmed().withChargeId(charge.id).build();
      const dbError = new Error('connection lost mid-transaction');

      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findByIdForUpdate.mockResolvedValue(charge);
      chargeRepo.save.mockRejectedValue(dbError);

      const error = await getError(() => service.execute(webhookEvent));

      expect(error).toBe(dbError);
    });
  });
});
