import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { TransactionRunner } from '@/shared/database/transaction-runner';

describe('TransactionRunner', () => {
  it('delega para dataSource.transaction e retorna o resultado do callback', async () => {
    const fakeManager = {} as EntityManager;
    const dataSource = {
      transaction: vi.fn((work: (manager: EntityManager) => Promise<unknown>) => work(fakeManager)),
    } as unknown as DataSource;

    const runner = new TransactionRunner(dataSource);
    const result = await runner.run(async (manager) => {
      expect(manager).toBe(fakeManager);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('propaga o erro lançado dentro da transação', async () => {
    const dataSource = {
      transaction: vi.fn((work: (manager: EntityManager) => Promise<unknown>) =>
        work({} as EntityManager),
      ),
    } as unknown as DataSource;

    const runner = new TransactionRunner(dataSource);

    await expect(
      runner.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
