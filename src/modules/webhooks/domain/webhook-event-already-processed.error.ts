import { DomainError } from '@/shared/errors/domain.error';
import { ErrorCode } from '@/shared/errors/error-code.enum';

export class WebhookEventAlreadyProcessedError extends DomainError {
  constructor(readonly eventId: string) {
    super(
      `Webhook event already processed: "${eventId}"`,
      ErrorCode.WEBHOOK_EVENT_ALREADY_PROCESSED,
    );
  }
}
