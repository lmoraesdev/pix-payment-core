import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Charge } from '@/modules/charges/domain/charge.entity';
import { IdempotencyKey } from '@/modules/charges/infrastructure/idempotency-key.entity';
import { WebhookEvent } from '@/modules/webhooks/domain/webhook-event.entity';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? 5432),
  username: process.env['DB_USERNAME'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? 'postgres',
  database: process.env['DB_DATABASE'] ?? 'pix_payment',
  entities: [Charge, IdempotencyKey, WebhookEvent],
  synchronize: process.env['TYPEORM_SYNCHRONIZE'] === 'true',
  logging: process.env['TYPEORM_LOGGING'] === 'true',
  // Limites explícitos em vez dos defaults do driver `pg`: sem eles, o pool
  // (padrão 10 conexões) e queries sem timeout são a causa mais comum de
  // esgotamento de conexão sob carga — o mesmo tipo de gargalo "invisível"
  // que a Shopify só descobriu instrumentando hold time de conexão em produção.
  extra: {
    max: Number(process.env['DB_POOL_MAX'] ?? 20),
    idleTimeoutMillis: Number(process.env['DB_IDLE_TIMEOUT_MS'] ?? 30_000),
    connectionTimeoutMillis: Number(process.env['DB_CONNECTION_TIMEOUT_MS'] ?? 5_000),
    statement_timeout: Number(process.env['DB_STATEMENT_TIMEOUT_MS'] ?? 10_000),
  },
});
