import { beforeEach, describe, expect, vi } from 'vitest';
import { GetChargeService } from '@/modules/charges/application/get-charge.service';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import type { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { runTests, setupStubs, assertStubs, getError } from '@test/helpers';
import type { TestCase, StubConfig, CallMatchConfig } from '@test/helpers';
import { aCharge } from '@test/builders';

// ─── Tipos do Test Table ──────────────────────────────────────────────────────

interface Input {
  chargeId: string;
  stubs: {
    chargeRepo: Partial<Record<'findById', StubConfig>>;
  };
}

interface Output {
  error: boolean;
  errorClass?: new (...args: never[]) => Error;
  errorId?: string;
  dto?: Record<string, unknown>;
  stubs: {
    chargeRepo: Partial<Record<'findById', CallMatchConfig>>;
  };
}

// ─── Dados compartilhados ─────────────────────────────────────────────────────

const existingCharge = aCharge().awaitingPayment().build();
const missingId = 'id-que-nao-existe';

// ─── Test Cases ───────────────────────────────────────────────────────────────

const testCases: Array<TestCase<Input, Output>> = [
  {
    name: 'charge encontrada → retorna ChargeResponseDto com todos os campos',
    input: {
      chargeId: existingCharge.id,
      stubs: { chargeRepo: { findById: { resolves: existingCharge } } },
    },
    output: {
      error: false,
      dto: {
        id: existingCharge.id,
        status: existingCharge.status,
        amount: existingCharge.amount,
        currency: existingCharge.currency,
        qr_code: existingCharge.qrCode,
        expires_at: existingCharge.expiresAt,
        created_at: existingCharge.createdAt,
      },
      stubs: { chargeRepo: { findById: { calledOnceWith: [existingCharge.id] } } },
    },
  },
  {
    name: 'charge não encontrada → lança ChargeNotFoundError com o id correto',
    input: {
      chargeId: missingId,
      stubs: { chargeRepo: { findById: { resolves: null } } },
    },
    output: {
      error: true,
      errorClass: ChargeNotFoundError,
      errorId: missingId,
      stubs: { chargeRepo: { findById: { calledOnceWith: [missingId] } } },
    },
  },
];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('GetChargeService', () => {
  let service: GetChargeService;
  let chargeRepo: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    chargeRepo = { findById: vi.fn() };
    service = new GetChargeService(chargeRepo as unknown as ChargeRepository);
  });

  runTests(testCases, async (_name, { input, output }) => {
    setupStubs(chargeRepo, input.stubs.chargeRepo);

    if (output.error) {
      const error = await getError(() => service.execute(input.chargeId));
      if (output.errorClass) expect(error).toBeInstanceOf(output.errorClass);
      if (output.errorId) {
        expect((error as unknown as ChargeNotFoundError).id).toBe(output.errorId);
      }
    } else {
      const result = await service.execute(input.chargeId);
      if (output.dto) expect(result).toEqual(output.dto);
    }

    assertStubs('chargeRepo', chargeRepo, output.stubs.chargeRepo);
  });
});
