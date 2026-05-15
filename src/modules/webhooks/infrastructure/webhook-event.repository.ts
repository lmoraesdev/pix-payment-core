import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from '../domain/webhook-event.entity';
import { WebhookEventAlreadyProcessedError } from '../domain/webhook-event-already-processed.error';

@Injectable()
export class WebhookEventRepository {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly repo: Repository<WebhookEvent>,
  ) {}

  /**
   * Attempts to record the event as processed. Throws
   * WebhookEventAlreadyProcessedError if the eventId was already stored,
   * making the dedup check atomic with the insert.
   */
  async markAsProcessed(eventId: string): Promise<void> {
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(WebhookEvent)
      .values({ eventId, processedAt: new Date() })
      .orIgnore()
      .execute();

    if (result.raw.length === 0) {
      throw new WebhookEventAlreadyProcessedError(eventId);
    }
  }
}
