import { faker } from '@faker-js/faker';
import type { WebhookEventDto } from '@/modules/webhooks/application/dto/webhook-event.dto';

export class WebhookEventDtoBuilder {
  private data = {
    event_id: `evt-${faker.string.uuid()}`,
    type: 'payment.confirmed' as 'payment.confirmed' | 'payment.expired',
    charge_id: faker.string.uuid(),
    occurred_at: faker.date.recent().toISOString(),
  };

  withEventId(id: string): this { this.data.event_id = id; return this; }
  withType(t: 'payment.confirmed' | 'payment.expired'): this { this.data.type = t; return this; }
  withChargeId(id: string): this { this.data.charge_id = id; return this; }
  confirmed(): this { this.data.type = 'payment.confirmed'; return this; }
  expired(): this { this.data.type = 'payment.expired'; return this; }

  build(): WebhookEventDto {
    return { ...this.data } as unknown as WebhookEventDto;
  }
}

export const aWebhookEvent = () => new WebhookEventDtoBuilder();
