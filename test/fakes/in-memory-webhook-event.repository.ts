import { WebhookEventAlreadyProcessedError } from '@/modules/webhooks/domain/webhook-event-already-processed.error';

export class InMemoryWebhookEventRepository {
  private processed = new Set<string>();

  async markAsProcessed(eventId: string): Promise<void> {
    if (this.processed.has(eventId)) {
      throw new WebhookEventAlreadyProcessedError(eventId);
    }
    this.processed.add(eventId);
  }

  has(eventId: string): boolean {
    return this.processed.has(eventId);
  }

  count(): number {
    return this.processed.size;
  }

  clear(): void {
    this.processed.clear();
  }
}
