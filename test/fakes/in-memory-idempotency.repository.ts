import type { IdempotencyKey } from '@/modules/charges/infrastructure/idempotency-key.entity';

export class InMemoryIdempotencyRepository {
  private store = new Map<string, IdempotencyKey>();

  async findByKey(key: string): Promise<IdempotencyKey | null> {
    return this.store.get(key) ?? null;
  }

  async save(record: IdempotencyKey): Promise<IdempotencyKey> {
    this.store.set(record.key, record);
    return record;
  }

  count(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
