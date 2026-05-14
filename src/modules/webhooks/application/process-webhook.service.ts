import { Injectable } from '@nestjs/common';
import { WebhookEventDto } from './dto/webhook-event.dto';

@Injectable()
export class ProcessWebhookService {
  async execute(_dto: WebhookEventDto): Promise<void> {
    // TODO: implement next session
    // 1. INSERT INTO webhook_events ON CONFLICT DO NOTHING → if 0 rows affected, return early (dedup)
    // 2. Find charge by charge_id (throw 404 if missing)
    // 3. Map event type to ChargeStatus transition (payment.confirmed → PAID, payment.expired → EXPIRED)
    // 4. charge.transitionTo(nextStatus) — state machine validates the move
    // 5. Persist updated charge
    throw new Error('Not implemented');
  }
}
