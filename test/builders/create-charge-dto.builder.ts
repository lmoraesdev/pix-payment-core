import { faker } from '@faker-js/faker';
import type { CreateChargeDto } from '@/modules/charges/application/dto/create-charge.dto';

export class CreateChargeDtoBuilder {
  private data: Record<string, unknown> = {
    amount: faker.number.int({ min: 100, max: 100_000 }),
    currency: 'BRL',
    payer_document: faker.string.numeric(11),
    description: faker.commerce.productName(),
  };

  withAmount(a: number): this { this.data.amount = a; return this; }
  withCurrency(c: string): this { this.data.currency = c; return this; }
  withPayerDocument(d: string): this { this.data.payer_document = d; return this; }
  withDescription(d: string): this { this.data.description = d; return this; }
  withoutCurrency(): this { delete this.data.currency; return this; }
  withoutDescription(): this { delete this.data.description; return this; }

  build(): CreateChargeDto {
    return { ...this.data } as unknown as CreateChargeDto;
  }
}

export const aCreateChargeDto = () => new CreateChargeDtoBuilder();
