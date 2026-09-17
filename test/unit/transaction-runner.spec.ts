import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import {
  InvalidTransactionTagError,
  TransactionRunner,
  type TransactionTag,
} from '@/shared/database/transaction-runner';
import { runTests, assertStubs, getError } from '@test/helpers';
import type { TestCase, CallMatchConfig } from '@test/helpers';
import { createMockLogger } from '@test/fakes';

class BoomError extends Error {}

// ─── Tipos do Test Table ──────────────────────────────────────────────────────

interface Input {
  tag: TransactionTag | 'refund_charge';
  work: () => Promise<string>;
  warnMs?: string;
}

interface Output {
  error: boolean;
  errorClass?: new (...args: never[]) => Error;
  transaction: Partial<Record<'transaction', CallMatchConfig>>;
  logs?: { method: 'log' | 'warn'; what: string; outcome: 'success' | 'failure' };
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

const testCases: Array<TestCase<Input, Output>> = [
  {
    name: 'tag fora da allowlist → InvalidTransactionTagError, dataSource.transaction nunca chamado',
    input: { tag: 'refund_charge', work: async () => 'unused' },
    output: {
      error: true,
      errorClass: InvalidTransactionTagError,
      transaction: { transaction: { notCalled: true } },
    },
  },
  {
    name: 'sucesso dentro do limite → log db_transaction_completed, outcome success',
    input: { tag: 'create_charge', work: async () => 'ok' },
    output: {
      error: false,
      transaction: { transaction: { calledTimes: 1 } },
      logs: { method: 'log', what: 'db_transaction_completed', outcome: 'success' },
    },
  },
  {
    name: 'callback lança erro → propaga, log db_transaction_failed, outcome failure',
    input: {
      tag: 'process_webhook',
      work: async () => {
        throw new BoomError('boom');
      },
    },
    output: {
      error: true,
      errorClass: BoomError,
      transaction: { transaction: { calledTimes: 1 } },
      logs: { method: 'log', what: 'db_transaction_failed', outcome: 'failure' },
    },
  },
  {
    name: 'duração acima de DB_TX_WARN_MS → warn em vez de log, mesmo em sucesso',
    input: { tag: 'create_charge', work: async () => 'ok', warnMs: '-1' },
    output: {
      error: false,
      transaction: { transaction: { calledTimes: 1 } },
      logs: { method: 'warn', what: 'db_transaction_completed', outcome: 'success' },
    },
  },
];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('TransactionRunner', () => {
  let queryMock: ReturnType<typeof vi.fn>;
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let mockLogger: ReturnType<typeof createMockLogger>;
  let runner: TransactionRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    queryMock = vi.fn().mockResolvedValue(undefined);
    dataSource = {
      transaction: vi.fn((work: (manager: EntityManager) => Promise<unknown>) =>
        work({ query: queryMock } as unknown as EntityManager),
      ),
    };
    mockLogger = createMockLogger();
    runner = new TransactionRunner(dataSource as unknown as DataSource, mockLogger);
  });

  runTests(testCases, async (_name, { input, output }) => {
    const originalWarnMs = process.env['DB_TX_WARN_MS'];
    if (input.warnMs !== undefined) process.env['DB_TX_WARN_MS'] = input.warnMs;

    try {
      if (output.error) {
        const error = await getError(() => runner.run(input.tag as TransactionTag, input.work));
        if (output.errorClass) expect(error).toBeInstanceOf(output.errorClass);
      } else {
        const result = await runner.run(input.tag as TransactionTag, input.work);
        expect(result).toBe('ok');
      }

      assertStubs('dataSource', dataSource, output.transaction);

      if (output.logs) {
        expect(mockLogger[output.logs.method]).toHaveBeenCalledWith(
          expect.objectContaining({
            what: output.logs.what,
            outcome: output.logs.outcome,
            tag: input.tag,
            duration_ms: expect.any(Number),
          }),
        );
      }
    } finally {
      if (originalWarnMs === undefined) delete process.env['DB_TX_WARN_MS'];
      else process.env['DB_TX_WARN_MS'] = originalWarnMs;
    }
  });

  describe('application_name e passagem de resultado', () => {
    it('roda set_config(application_name) parametrizado como primeira instrução', async () => {
      await runner.run('create_charge', async () => 'ok');

      expect(queryMock).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
        'application_name',
        'pix-core:create_charge',
      ]);
    });

    it('devolve o valor retornado pelo callback', async () => {
      const result = await runner.run('process_webhook', async () => 'callback-result');

      expect(result).toBe('callback-result');
    });
  });
});
