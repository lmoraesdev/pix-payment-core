import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { WebhookSignatureGuard } from '@/shared/guards/webhook-signature.guard';
import { WebhookEventDto } from '@/modules/webhooks/application/dto/webhook-event.dto';
import { ProcessWebhookService } from '@/modules/webhooks/application/process-webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(WebhookSignatureGuard)
export class WebhooksController {
  constructor(private readonly processWebhookService: ProcessWebhookService) {}

  @Post('provider')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive webhook event from payment provider',
    description:
      'Processes an incoming payment event. Idempotent: duplicate events with the same event_id are silently ignored.',
  })
  @ApiHeader({
    name: 'X-Webhook-Signature',
    required: true,
    description: 'HMAC-SHA256 signature of the raw request body, hex-encoded.',
  })
  @ApiResponse({ status: 200, description: 'Event processed (or already processed)' })
  @ApiResponse({ status: 400, description: 'Invalid body' })
  @ApiResponse({ status: 401, description: 'Missing or invalid signature' })
  @ApiResponse({ status: 404, description: 'Charge referenced by the event does not exist' })
  @ApiResponse({ status: 409, description: 'Invalid state transition for the charge' })
  async process(@Body() dto: WebhookEventDto): Promise<{ received: true }> {
    await this.processWebhookService.execute(dto);
    return { received: true };
  }
}
