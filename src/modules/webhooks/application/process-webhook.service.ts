import { Injectable } from '@nestjs/common';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { WebhookEventAlreadyProcessedError } from '@/modules/webhooks/domain/webhook-event-already-processed.error';
import { WebhookEventRepository } from '@/modules/webhooks/infrastructure/webhook-event.repository';
import { WebhookEventDto } from './dto/webhook-event.dto';

const EVENT_TYPE_TO_STATUS: Record<string, ChargeStatus> = {
  'payment.confirmed': ChargeStatus.PAID,
  'payment.expired': ChargeStatus.EXPIRED,
};

@Injectable()
export class ProcessWebhookService {
  constructor(
    private readonly chargeRepository: ChargeRepository,
    private readonly webhookEventRepository: WebhookEventRepository,
  ) {}

  async execute(dto: WebhookEventDto): Promise<void> {
    try {
      await this.webhookEventRepository.markAsProcessed(dto.event_id);
    } catch (err) {
      if (err instanceof WebhookEventAlreadyProcessedError) return;
      throw err;
    }

    const charge = await this.chargeRepository.findById(dto.charge_id);
    if (!charge) throw new ChargeNotFoundError(dto.charge_id);

    const nextStatus = EVENT_TYPE_TO_STATUS[dto.type];
    if (!nextStatus) throw new Error(`Unknown event type: "${dto.type}"`);

    charge.transitionTo(nextStatus);

    await this.chargeRepository.save(charge);
  }
}
