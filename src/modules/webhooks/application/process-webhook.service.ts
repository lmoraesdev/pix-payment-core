import { Injectable } from '@nestjs/common';
import { ChargeRepository } from '../../charges/infrastructure/charge.repository';
import { WebhookEventRepository } from '../infrastructure/webhook-event.repository';
import { WebhookEventDto } from './dto/webhook-event.dto';

@Injectable()
export class ProcessWebhookService {
  constructor(
    private readonly chargeRepository: ChargeRepository,
    private readonly webhookEventRepository: WebhookEventRepository,
  ) {}

  async execute(_dto: WebhookEventDto): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
