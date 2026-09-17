import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { PoolMetricsService } from '@/shared/database/pool-metrics.service';
import { createMockLogger } from '@test/fakes';

interface FakePool {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

function aDataSource(pool: FakePool): DataSource {
  return { driver: { master: pool } } as unknown as DataSource;
}

describe('PoolMetricsService', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waiting === 0 → log db_pool_stats a cada DB_POOL_METRICS_INTERVAL_MS', () => {
    const pool = { totalCount: 5, idleCount: 5, waitingCount: 0 };
    const service = new PoolMetricsService(aDataSource(pool), mockLogger);

    service.onModuleInit();
    vi.advanceTimersByTime(30_000);

    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ what: 'db_pool_stats', total: 5, idle: 5, waiting: 0 }),
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();

    service.onModuleDestroy();
  });

  it('waiting > 0 → warn, porque significa requisição esperando conexão', () => {
    const pool = { totalCount: 20, idleCount: 0, waitingCount: 3 };
    const service = new PoolMetricsService(aDataSource(pool), mockLogger);

    service.onModuleInit();
    vi.advanceTimersByTime(30_000);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ what: 'db_pool_stats', waiting: 3 }),
    );
    expect(mockLogger.log).not.toHaveBeenCalled();

    service.onModuleDestroy();
  });

  it('onModuleDestroy limpa o interval e para de coletar', () => {
    const pool = { totalCount: 1, idleCount: 1, waitingCount: 0 };
    const service = new PoolMetricsService(aDataSource(pool), mockLogger);

    service.onModuleInit();
    service.onModuleDestroy();
    vi.advanceTimersByTime(60_000);

    expect(mockLogger.log).not.toHaveBeenCalled();
  });

  it('respeita DB_POOL_METRICS_INTERVAL_MS customizado', () => {
    const originalEnv = process.env['DB_POOL_METRICS_INTERVAL_MS'];
    process.env['DB_POOL_METRICS_INTERVAL_MS'] = '5000';

    const pool = { totalCount: 2, idleCount: 2, waitingCount: 0 };
    const service = new PoolMetricsService(aDataSource(pool), mockLogger);

    service.onModuleInit();
    vi.advanceTimersByTime(4_999);
    expect(mockLogger.log).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockLogger.log).toHaveBeenCalledWith(expect.objectContaining({ what: 'db_pool_stats' }));

    service.onModuleDestroy();
    if (originalEnv === undefined) delete process.env['DB_POOL_METRICS_INTERVAL_MS'];
    else process.env['DB_POOL_METRICS_INTERVAL_MS'] = originalEnv;
  });
});
