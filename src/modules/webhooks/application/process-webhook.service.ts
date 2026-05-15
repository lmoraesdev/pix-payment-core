import { Injectable } from '@nestjs/common';

import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';
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
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly chargeRepository: ChargeRepository,
    private readonly webhookEventRepository: WebhookEventRepository,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger.forContext('ProcessWebhookService');
  }

  async execute(dto: WebhookEventDto): Promise<void> {
    this.logger.log({
      what: 'webhook_received',
      why: 'payment_provider_event',
      how: 'POST /webhooks/provider',
      event_id: dto.event_id,
      type: dto.type,
      charge_id: dto.charge_id,
    });

    try {
      await this.webhookEventRepository.markAsProcessed(dto.event_id);
    } catch (err) {
      if (err instanceof WebhookEventAlreadyProcessedError) {
        this.logger.log({
          what: 'webhook_already_processed',
          why: 'duplicate_event',
          event_id: dto.event_id,
        });
        return;
      }
      throw err;
    }

    const charge = await this.chargeRepository.findById(dto.charge_id);
    if (!charge) throw new ChargeNotFoundError(dto.charge_id);

    const nextStatus = EVENT_TYPE_TO_STATUS[dto.type];
    if (!nextStatus) throw new Error(`Unknown event type: "${dto.type}"`);

    const fromStatus = charge.status;
    charge.transitionTo(nextStatus);

    this.logger.log({
      what: 'charge_state_transitioned',
      why: dto.type,
      charge_id: dto.charge_id,
      from: fromStatus,
      to: nextStatus,
    });

    await this.chargeRepository.save(charge);
  }
}
