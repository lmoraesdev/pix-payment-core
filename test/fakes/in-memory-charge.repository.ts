import type { Charge } from '@/modules/charges/domain/charge.entity';
import { ChargeStateMachine } from '@/modules/charges/domain/charge-state-machine';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';

export class InMemoryChargeRepository {
  private store = new Map<string, Charge>();

  seed(charge: Charge): void {
    this.store.set(charge.id, charge);
  }

  seedMany(charges: Charge[]): void {
    charges.forEach((c) => this.seed(c));
  }

  async findById(id: string): Promise<Charge | null> {
    return this.store.get(id) ?? null;
  }

  async save(charge: Charge): Promise<Charge> {
    const stored = { ...charge } as Charge;
    stored.transitionTo = (next: ChargeStatus): void => {
      stored.status = new ChargeStateMachine(stored.status).transitionTo(next);
    };
    this.store.set(stored.id, stored);
    return stored;
  }

  count(): number {
    return this.store.size;
  }

  all(): Charge[] {
    return [...this.store.values()];
  }

  clear(): void {
    this.store.clear();
  }
}
