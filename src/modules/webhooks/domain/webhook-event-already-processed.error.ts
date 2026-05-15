export class WebhookEventAlreadyProcessedError extends Error {
  constructor(readonly eventId: string) {
    super(`Webhook event already processed: "${eventId}"`);
    this.name = 'WebhookEventAlreadyProcessedError';
  }
}
