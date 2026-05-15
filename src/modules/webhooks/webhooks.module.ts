import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from './domain/webhook-event.entity';
import { WebhookEventRepository } from './infrastructure/webhook-event.repository';
import { ProcessWebhookService } from './application/process-webhook.service';
import { WebhooksController } from './presentation/webhooks.controller';
import { ChargesModule } from '@/modules/charges/charges.module';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent]), ChargesModule],
  controllers: [WebhooksController],
  providers: [WebhookEventRepository, ProcessWebhookService],
})
export class WebhooksModule {}
