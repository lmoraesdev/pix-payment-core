import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const WebhookEventSchema = z.object({
  event_id: z.string(),
  type: z.enum(['payment.confirmed', 'payment.expired']),
  charge_id: z.string(),
  occurred_at: z.string(),
});

export class WebhookEventDto extends createZodDto(WebhookEventSchema) {}
