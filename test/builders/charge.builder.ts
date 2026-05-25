import { faker } from '@faker-js/faker';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { ChargeStateMachine } from '@/modules/charges/domain/charge-state-machine';
import type { Charge } from '@/modules/charges/domain/charge.entity';

export class ChargeBuilder {
  private data: Partial<Charge> = {
    id: faker.string.uuid(),
    status: ChargeStatus.AWAITING_PAYMENT,
    amount: faker.number.int({ min: 100, max: 2_147_483_647 }),
    currency: 'BRL',
    payerDocument: faker.string.numeric(11),
    description: faker.commerce.productName(),
    qrCode: null,
    expiresAt: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
  };

  withId(id: string): this { this.data.id = id; return this; }
  withStatus(s: ChargeStatus): this { this.data.status = s; return this; }
  withAmount(a: number): this { this.data.amount = a; return this; }
  withCurrency(c: string): this { this.data.currency = c; return this; }
  withPayerDocument(d: string): this { this.data.payerDocument = d; return this; }
  withDescription(d: string | null): this { this.data.description = d; return this; }
  withQrCode(q: string | null): this { this.data.qrCode = q; return this; }
  withExpiresAt(e: Date | null): this { this.data.expiresAt = e; return this; }
  created(): this { this.data.status = ChargeStatus.CREATED; return this; }
  awaitingPayment(): this { this.data.status = ChargeStatus.AWAITING_PAYMENT; return this; }
  paid(): this { this.data.status = ChargeStatus.PAID; return this; }
  expired(): this { this.data.status = ChargeStatus.EXPIRED; return this; }

  build(): Charge {
    const charge = { ...this.data } as Charge;
    charge.transitionTo = (next: ChargeStatus): void => {
      charge.status = new ChargeStateMachine(charge.status).transitionTo(next);
    };
    return charge;
  }
}

export const aCharge = () => new ChargeBuilder();
