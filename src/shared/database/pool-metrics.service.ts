import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

interface PgPoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

// Snapshot periódico do pool de conexões do driver `pg`. `waitingCount > 0`
// significa uma requisição esperando uma conexão livre — o sintoma direto de
// conexões sendo seguradas por mais tempo do que o pool suporta, o mesmo tipo
// de sinal que faltava no incidente descrito no artigo da Shopify.
@Injectable()
export class PoolMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: StructuredLoggerService;
  private intervalHandle?: NodeJS.Timeout;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger.forContext('PoolMetricsService');
  }

  onModuleInit(): void {
    const intervalMs = Number(process.env['DB_POOL_METRICS_INTERVAL_MS'] ?? 30_000);
    this.intervalHandle = setInterval(() => this.reportPoolStats(), intervalMs);
    // unref: esse timer nunca deve ser o motivo do processo continuar vivo.
    this.intervalHandle.unref();
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  private reportPoolStats(): void {
    const pool = this.getPgPool();
    if (!pool) return;

    const payload = {
      what: 'db_pool_stats',
      why: 'connection_hold_visibility',
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };

    if (pool.waitingCount > 0) {
      this.logger.warn(payload);
    } else {
      this.logger.log(payload);
    }
  }

  private getPgPool(): PgPoolStats | undefined {
    return (this.dataSource.driver as unknown as { master?: PgPoolStats }).master;
  }
}
