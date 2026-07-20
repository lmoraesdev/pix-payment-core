import { Injectable } from '@nestjs/common';

import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';
import { DomainError } from '@/shared/errors/domain.error';
import { TransactionRunner } from '@/shared/database/transaction-runner';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { UnknownEventTypeError } from '@/modules/webhooks/domain/unknown-event-type.error';
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
    private readonly transactionRunner: TransactionRunner,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger.forContext('ProcessWebhookService');
  }

  async execute(dto: WebhookEventDto): Promise<void> {
    try {
      this.logger.log({
        what: 'webhook_received',
        why: 'payment_provider_event',
        how: 'POST /webhooks/provider',
        event_id: dto.event_id,
        type: dto.type,
        charge_id: dto.charge_id,
      });

      await this.transactionRunner.run(async (manager) => {
        try {
          await this.webhookEventRepository.markAsProcessed(dto.event_id, manager);
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

        // Lock pessimista: bloqueia a linha da charge até o fim da transação,
        // evitando que dois webhooks concorrentes leiam o mesmo estado e um
        // sobrescreva a transição do outro (lost update).
        const charge = await this.chargeRepository.findByIdForUpdate(dto.charge_id, manager);
        if (!charge) throw new ChargeNotFoundError(dto.charge_id);

        const nextStatus = EVENT_TYPE_TO_STATUS[dto.type];
        if (!nextStatus) throw new UnknownEventTypeError(dto.type);

        const fromStatus = charge.status;
        charge.transitionTo(nextStatus);

        await this.chargeRepository.save(charge, manager);

        this.logger.log({
          what: 'charge_state_transitioned',
          why: dto.type,
          charge_id: dto.charge_id,
          from: fromStatus,
          to: nextStatus,
        });
      });
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(
        {
          what: 'process_webhook_failed',
          why: 'unexpected_error',
          how: 'POST /webhooks/provider',
          event_id: dto.event_id,
          charge_id: dto.charge_id,
          message: (err as Error).message,
        },
        (err as Error).stack,
      );
      throw err;
    }
  }
}
