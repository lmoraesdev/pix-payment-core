import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { WebhookEventDto } from '../application/dto/webhook-event.dto';
import { ProcessWebhookService } from '../application/process-webhook.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly processWebhookService: ProcessWebhookService) {}

  @Post('provider')
  @HttpCode(200)
  process(@Body() dto: WebhookEventDto): Promise<void> {
    return this.processWebhookService.execute(dto);
  }
}
