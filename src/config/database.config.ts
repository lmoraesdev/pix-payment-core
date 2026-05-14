import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Charge } from '../modules/charges/domain/charge.entity';
import { IdempotencyKey } from '../modules/charges/infrastructure/idempotency-key.entity';
import { WebhookEvent } from '../modules/webhooks/domain/webhook-event.entity';

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
});
