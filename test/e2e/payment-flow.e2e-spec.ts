import { createHmac } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { faker } from '@faker-js/faker';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CreateChargeService } from '@/modules/charges/application/create-charge.service';
import { GetChargeService } from '@/modules/charges/application/get-charge.service';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { IdempotencyRepository } from '@/modules/charges/infrastructure/idempotency.repository';
import { ChargesController } from '@/modules/charges/presentation/charges.controller';
import { ProcessWebhookService } from '@/modules/webhooks/application/process-webhook.service';
import { WebhookEventRepository } from '@/modules/webhooks/infrastructure/webhook-event.repository';
import { WebhooksController } from '@/modules/webhooks/presentation/webhooks.controller';
import { DomainExceptionFilter } from '@/shared/filters/domain-exception.filter';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';
import {
  InMemoryChargeRepository,
  InMemoryIdempotencyRepository,
  InMemoryWebhookEventRepository,
} from '../fakes';
import { aCreateChargeDto, aWebhookEvent } from '../builders';

const TEST_SECRET = 'test-webhook-secret';

function sign(rawJson: string): string {
  return createHmac('sha256', TEST_SECRET).update(rawJson).digest('hex');
}

describe('Payment flow — happy path (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env['WEBHOOK_SECRET'] = TEST_SECRET;

    const chargeRepo = new InMemoryChargeRepository();
    const idempotencyRepo = new InMemoryIdempotencyRepository();
    const webhookEventRepo = new InMemoryWebhookEventRepository();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChargesController, WebhooksController],
      providers: [
        StructuredLoggerService,
        CreateChargeService,
        GetChargeService,
        ProcessWebhookService,
        { provide: ChargeRepository, useValue: chargeRepo },
        { provide: IdempotencyRepository, useValue: idempotencyRepo },
        { provide: WebhookEventRepository, useValue: webhookEventRepo },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a charge, receives a webhook, and reflects PAID status', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/charges')
      .set('Idempotency-Key', faker.string.uuid())
      .set('Content-Type', 'application/json')
      .send(aCreateChargeDto().build());

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('AWAITING_PAYMENT');

    const chargeId = createRes.body.id as string;
    expect(chargeId).toBeDefined();

    const getRes1 = await request(app.getHttpServer()).get(`/charges/${chargeId}`);

    expect(getRes1.status).toBe(200);
    expect(getRes1.body.status).toBe('AWAITING_PAYMENT');

    const webhookPayload = JSON.stringify(
      aWebhookEvent().confirmed().withChargeId(chargeId).build(),
    );

    const webhookRes = await request(app.getHttpServer())
      .post('/webhooks/provider')
      .set('Content-Type', 'application/json')
      .set('X-Webhook-Signature', sign(webhookPayload))
      .send(webhookPayload);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.received).toBe(true);

    const getRes2 = await request(app.getHttpServer()).get(`/charges/${chargeId}`);

    expect(getRes2.status).toBe(200);
    expect(getRes2.body.status).toBe('PAID');
  });
});
