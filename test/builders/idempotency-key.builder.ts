import { faker } from '@faker-js/faker';
import { createHash } from 'crypto';
import type { IdempotencyKey } from '@/modules/charges/infrastructure/idempotency-key.entity';

export class IdempotencyKeyBuilder {
  private data: Partial<IdempotencyKey> = {
    key: faker.string.uuid(),
    chargeId: faker.string.uuid(),
    requestHash: createHash('sha256').update(faker.string.alphanumeric(32)).digest('hex'),
    responseBody: {},
    createdAt: faker.date.recent(),
  };

  withKey(k: string): this { this.data.key = k; return this; }
  withChargeId(id: string): this { this.data.chargeId = id; return this; }
  withRequestHash(h: string): this { this.data.requestHash = h; return this; }
  withResponseBody(r: Record<string, unknown>): this { this.data.responseBody = r; return this; }

  build(): IdempotencyKey {
    return { ...this.data } as IdempotencyKey;
  }
}

export const anIdempotencyKey = () => new IdempotencyKeyBuilder();
