import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { WebhookEvent } from '@/modules/webhooks/domain/webhook-event.entity';
import { WebhookEventAlreadyProcessedError } from '@/modules/webhooks/domain/webhook-event-already-processed.error';

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
  async markAsProcessed(eventId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(WebhookEvent) : this.repo;
    const result = await repo
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
