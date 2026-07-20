import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { QueryFailedError } from 'typeorm';
import { faker } from '@faker-js/faker';
import { CreateChargeService } from '@/modules/charges/application/create-charge.service';
import { IdempotencyConflictError } from '@/modules/charges/domain/idempotency-conflict.error';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import type { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import type { IdempotencyRepository } from '@/modules/charges/infrastructure/idempotency.repository';
import type { IdempotencyKey } from '@/modules/charges/infrastructure/idempotency-key.entity';
import type { TransactionRunner } from '@/shared/database/transaction-runner';
import { runTests, setupStubs, assertStubs, getError } from '@test/helpers';
import type { TestCase, StubConfig, CallMatchConfig } from '@test/helpers';
import { aCharge, aCreateChargeDto, anIdempotencyKey } from '@test/builders';
import { createMockLogger } from '@test/fakes';

function fakeUniqueViolation(): QueryFailedError {
  const err = new QueryFailedError('INSERT ...', [], new Error('duplicate key'));
  (err as unknown as { code: string }).code = '23505';
  return err;
}

// ─── Canonical hash ───────────────────────────────────────────────────────────

function canonicalHash(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj)
    .filter(([, value]) => value !== undefined)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  return createHash('sha256')
    .update(JSON.stringify(Object.fromEntries(entries)))
    .digest('hex');
}

// ─── Tipos do Test Table ──────────────────────────────────────────────────────

interface Input {
  dto: ReturnType<typeof aCreateChargeDto.prototype.build>;
  idempotencyKey: string;
  stubs: {
    chargeRepo: Partial<Record<'save', StubConfig>>;
    idempotencyRepo: Partial<Record<'findByKey' | 'save', StubConfig>>;
  };
}

interface Output {
  error: boolean;
  errorClass?: new (...args: never[]) => Error;
  errorCode?: string;
  created?: boolean;
  stubs: {
    chargeRepo: Partial<Record<'save', CallMatchConfig>>;
    idempotencyRepo: Partial<Record<'findByKey' | 'save', CallMatchConfig>>;
  };
  logs?: { method: 'log' | 'warn' | 'error'; what: string };
}

// ─── Dados compartilhados ─────────────────────────────────────────────────────

const dto = aCreateChargeDto().build();
const idempotencyKey = 'idem-key-test';
const requestHash = canonicalHash(dto as unknown as Record<string, unknown>);
const savedCharge = aCharge().awaitingPayment().build();

// ─── Test Cases ───────────────────────────────────────────────────────────────

const testCases: Array<TestCase<Input, Output>> = [
  {
    name: 'key nova → cria charge, persiste key, retorna created: true',
    input: {
      dto,
      idempotencyKey,
      stubs: {
        idempotencyRepo: {
          findByKey: { resolves: null },
          save: { resolves: undefined },
        },
        chargeRepo: {
          save: { resolves: savedCharge },
        },
      },
    },
    output: {
      error: false,
      created: true,
      stubs: {
        chargeRepo: { save: { called: true } },
        idempotencyRepo: { findByKey: { called: true }, save: { called: true } },
      },
      logs: { method: 'log', what: 'charge_created' },
    },
  },
  {
    name: 'key existente + mesmo hash → retorna cache, created: false, sem persistir',
    input: {
      dto,
      idempotencyKey,
      stubs: {
        idempotencyRepo: {
          findByKey: {
            resolves: anIdempotencyKey()
              .withKey(idempotencyKey)
              .withChargeId(savedCharge.id)
              .withRequestHash(requestHash)
              .withResponseBody({ id: savedCharge.id } as Record<string, unknown>)
              .build(),
          },
        },
        chargeRepo: {},
      },
    },
    output: {
      error: false,
      created: false,
      stubs: {
        chargeRepo: { save: { notCalled: true } },
        idempotencyRepo: { findByKey: { called: true }, save: { notCalled: true } },
      },
      logs: { method: 'log', what: 'idempotency_cache_hit' },
    },
  },
  {
    name: 'key existente + hash diferente → lança IdempotencyConflictError',
    input: {
      dto,
      idempotencyKey,
      stubs: {
        idempotencyRepo: {
          findByKey: {
            resolves: anIdempotencyKey()
              .withKey(idempotencyKey)
              .withRequestHash('hash-completamente-diferente')
              .build(),
          },
        },
        chargeRepo: {},
      },
    },
    output: {
      error: true,
      errorClass: IdempotencyConflictError,
      errorCode: ErrorCode.IDEMPOTENCY_CONFLICT,
      stubs: {
        chargeRepo: { save: { notCalled: true } },
        idempotencyRepo: { findByKey: { called: true }, save: { notCalled: true } },
      },
      logs: { method: 'warn', what: 'idempotency_conflict' },
    },
  },
];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CreateChargeService', () => {
  let service: CreateChargeService;
  let chargeRepo: { save: ReturnType<typeof vi.fn> };
  let idempotencyRepo: { findByKey: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let transactionRunner: { run: ReturnType<typeof vi.fn> };
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    chargeRepo = { save: vi.fn() };
    idempotencyRepo = { findByKey: vi.fn(), save: vi.fn() };
    transactionRunner = { run: vi.fn((work: (manager: undefined) => unknown) => work(undefined)) };
    mockLogger = createMockLogger();
    service = new CreateChargeService(
      chargeRepo as unknown as ChargeRepository,
      idempotencyRepo as unknown as IdempotencyRepository,
      transactionRunner as unknown as TransactionRunner,
      mockLogger,
    );
  });

  runTests(testCases, async (_name, { input, output }) => {
    setupStubs(chargeRepo, input.stubs.chargeRepo);
    setupStubs(idempotencyRepo, input.stubs.idempotencyRepo);

    if (output.error) {
      const error = await getError(() => service.execute(input.dto, input.idempotencyKey));
      if (output.errorClass) expect(error).toBeInstanceOf(output.errorClass);
      if (output.errorCode) expect((error as unknown as { code: string }).code).toBe(output.errorCode);
    } else {
      const result = await service.execute(input.dto, input.idempotencyKey);
      if (output.created !== undefined) expect(result.created).toBe(output.created);
    }

    assertStubs('chargeRepo', chargeRepo, output.stubs.chargeRepo);
    assertStubs('idempotencyRepo', idempotencyRepo, output.stubs.idempotencyRepo);

    if (output.logs) {
      expect(mockLogger[output.logs.method]).toHaveBeenCalledWith(
        expect.objectContaining({ what: output.logs.what }),
      );
    }
  });

  describe('canonicalização do hash', () => {
    beforeEach(() => {
      idempotencyRepo.findByKey.mockResolvedValue(null);
      chargeRepo.save.mockResolvedValue(aCharge().build());
      idempotencyRepo.save.mockImplementation(async (record: IdempotencyKey) => record);
    });

    it('DTOs com mesmas chaves em ordens diferentes produzem o mesmo hash', async () => {
      const payerDocument = faker.string.numeric(11);
      const base = { amount: 100, currency: 'BRL', payer_document: payerDocument };

      const dtoOrderA = aCreateChargeDto()
        .withAmount(base.amount)
        .withCurrency(base.currency)
        .withPayerDocument(base.payer_document)
        .withoutDescription()
        .build();
      const dtoOrderB = {
        payer_document: base.payer_document,
        amount: base.amount,
        currency: base.currency,
      };

      await service.execute(
        dtoOrderA as unknown as ReturnType<typeof aCreateChargeDto.prototype.build>,
        'key-a',
      );
      const hashA = (idempotencyRepo.save.mock.calls[0][0] as IdempotencyKey).requestHash;

      vi.clearAllMocks();
      idempotencyRepo.findByKey.mockResolvedValue(null);
      chargeRepo.save.mockResolvedValue(aCharge().build());
      idempotencyRepo.save.mockImplementation(async (record: IdempotencyKey) => record);

      await service.execute(
        dtoOrderB as unknown as ReturnType<typeof aCreateChargeDto.prototype.build>,
        'key-b',
      );
      const hashB = (idempotencyRepo.save.mock.calls[0][0] as IdempotencyKey).requestHash;

      expect(hashA).toBe(hashB);
    });

    it('DTOs com valores diferentes produzem hashes diferentes', async () => {
      const payerDocument = faker.string.numeric(11);
      const dtoA = aCreateChargeDto()
        .withAmount(100)
        .withPayerDocument(payerDocument)
        .withoutDescription()
        .build();
      const dtoB = aCreateChargeDto()
        .withAmount(200)
        .withPayerDocument(payerDocument)
        .withoutDescription()
        .build();

      await service.execute(dtoA, 'key-a');
      const hashA = (idempotencyRepo.save.mock.calls[0][0] as IdempotencyKey).requestHash;

      vi.clearAllMocks();
      idempotencyRepo.findByKey.mockResolvedValue(null);
      chargeRepo.save.mockResolvedValue(aCharge().build());
      idempotencyRepo.save.mockImplementation(async (record: IdempotencyKey) => record);

      await service.execute(dtoB, 'key-b');
      const hashB = (idempotencyRepo.save.mock.calls[0][0] as IdempotencyKey).requestHash;

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('corrida de idempotency key (unique violation na transação)', () => {
    it('duas requisições concorrentes com o mesmo hash → a perdedora devolve a resposta cacheada da vencedora', async () => {
      const winner = anIdempotencyKey()
        .withKey(idempotencyKey)
        .withRequestHash(requestHash)
        .withResponseBody({ id: savedCharge.id } as Record<string, unknown>)
        .build();

      idempotencyRepo.findByKey.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
      chargeRepo.save.mockResolvedValue(savedCharge);
      idempotencyRepo.save.mockRejectedValue(fakeUniqueViolation());

      const result = await service.execute(dto, idempotencyKey);

      expect(result.created).toBe(false);
      expect(result.data).toBe(winner.responseBody);
      expect(idempotencyRepo.findByKey).toHaveBeenCalledTimes(2);
    });

    it('duas requisições concorrentes com hash diferente → lança IdempotencyConflictError', async () => {
      const winner = anIdempotencyKey()
        .withKey(idempotencyKey)
        .withRequestHash('hash-diferente-da-perdedora')
        .build();

      idempotencyRepo.findByKey.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
      chargeRepo.save.mockResolvedValue(savedCharge);
      idempotencyRepo.save.mockRejectedValue(fakeUniqueViolation());

      const error = await getError(() => service.execute(dto, idempotencyKey));

      expect(error).toBeInstanceOf(IdempotencyConflictError);
      expect((error as unknown as { code: string }).code).toBe(ErrorCode.IDEMPOTENCY_CONFLICT);
    });

    it('unique violation sem nenhum registro encontrado no reload → relança o erro original', async () => {
      idempotencyRepo.findByKey.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      chargeRepo.save.mockResolvedValue(savedCharge);
      const violation = fakeUniqueViolation();
      idempotencyRepo.save.mockRejectedValue(violation);

      const error = await getError(() => service.execute(dto, idempotencyKey));

      expect(error).toBe(violation);
    });

    it('as escritas de charge e idempotency key acontecem dentro da mesma transação', async () => {
      idempotencyRepo.findByKey.mockResolvedValueOnce(null);
      chargeRepo.save.mockResolvedValue(savedCharge);
      idempotencyRepo.save.mockResolvedValue(undefined);

      await service.execute(dto, idempotencyKey);

      expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    });
  });
});
