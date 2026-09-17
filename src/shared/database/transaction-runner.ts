import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

// Toda transação carrega um rótulo de quem a abriu — sem isso, uma conexão
// presa em pg_stat_activity não diz a que operação ela pertence.
export const TRANSACTION_TAGS = ['create_charge', 'process_webhook'] as const;
export type TransactionTag = (typeof TRANSACTION_TAGS)[number];

export class InvalidTransactionTagError extends Error {
  constructor(tag: string) {
    super(`Invalid transaction tag: "${tag}"`);
  }
}

function isTransactionTag(tag: string): tag is TransactionTag {
  return (TRANSACTION_TAGS as readonly string[]).includes(tag);
}

@Injectable()
export class TransactionRunner {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly dataSource: DataSource,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger.forContext('TransactionRunner');
  }

  async run<T>(tag: TransactionTag, work: (manager: EntityManager) => Promise<T>): Promise<T> {
    if (!isTransactionTag(tag)) {
      throw new InvalidTransactionTagError(tag);
    }

    const startedAt = Date.now();

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        // Primeira instrução da transação: identifica a conexão em
        // pg_stat_activity com a operação que está segurando-a. set_config
        // com parâmetro ligado (em vez de interpolar o tag num "SET LOCAL
        // application_name = '...'") evita qualquer string livre indo para o
        // SQL, mesmo já validado contra a allowlist acima. is_local=true
        // reproduz o escopo de SET LOCAL: some ao fim da transação.
        await manager.query('SELECT set_config($1, $2, true)', [
          'application_name',
          `pix-core:${tag}`,
        ]);

        return work(manager);
      });

      this.logOutcome('db_transaction_completed', 'success', tag, startedAt);
      return result;
    } catch (err) {
      this.logOutcome('db_transaction_failed', 'failure', tag, startedAt);
      throw err;
    }
  }

  private logOutcome(
    what: 'db_transaction_completed' | 'db_transaction_failed',
    outcome: 'success' | 'failure',
    tag: TransactionTag,
    startedAt: number,
  ): void {
    const durationMs = Date.now() - startedAt;
    const warnThresholdMs = Number(process.env['DB_TX_WARN_MS'] ?? 200);
    const payload = {
      what,
      why: 'connection_hold_visibility',
      tag,
      duration_ms: durationMs,
      outcome,
    };

    if (durationMs > warnThresholdMs) {
      this.logger.warn(payload);
    } else {
      this.logger.log(payload);
    }
  }
}
