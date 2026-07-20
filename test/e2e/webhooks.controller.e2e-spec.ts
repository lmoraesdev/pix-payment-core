import { createHmac } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { faker } from '@faker-js/faker';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessWebhookService } from '@/modules/webhooks/application/process-webhook.service';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';
import { WebhookEventRepository } from '@/modules/webhooks/infrastructure/webhook-event.repository';
import { WebhooksController } from '@/modules/webhooks/presentation/webhooks.controller';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { DomainExceptionFilter } from '@/shared/filters/domain-exception.filter';
import { TransactionRunner } from '@/shared/database/transaction-runner';
import { InMemoryChargeRepository, InMemoryWebhookEventRepository } from '../fakes';
import { aCharge, aWebhookEvent } from '../builders';

const TEST_SECRET = 'test-webhook-secret';
const fakeTransactionRunner = { run: (work: (manager: undefined) => unknown) => work(undefined) };

function sign(rawJson: string): string {
  return createHmac('sha256', TEST_SECRET).update(rawJson).digest('hex');
}

function signedPost(app: INestApplication, rawJson: string) {
  return request(app.getHttpServer())
    .post('/webhooks/provider')
    .set('Content-Type', 'application/json')
    .set('X-Webhook-Signature', sign(rawJson))
    .send(rawJson);
}

describe('WebhooksController (e2e)', () => {
  let app: INestApplication;
  let chargeRepo: InMemoryChargeRepository;
  let webhookEventRepo: InMemoryWebhookEventRepository;

  beforeEach(async () => {
    process.env['WEBHOOK_SECRET'] = TEST_SECRET;

    chargeRepo = new InMemoryChargeRepository();
    webhookEventRepo = new InMemoryWebhookEventRepository();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        StructuredLoggerService,
        ProcessWebhookService,
        { provide: ChargeRepository, useValue: chargeRepo },
        { provide: WebhookEventRepository, useValue: webhookEventRepo },
        { provide: TransactionRunner, useValue: fakeTransactionRunner },
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

  describe('assinatura HMAC', () => {
    it('retorna 401 sem header X-Webhook-Signature', async () => {
      const charge = aCharge().awaitingPayment().build();
      chargeRepo.seed(charge);
      const rawJson = JSON.stringify(aWebhookEvent().confirmed().withChargeId(charge.id).build());

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('Content-Type', 'application/json')
        .send(rawJson);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.AUTHENTICATION_FAILED);
    });

    it('retorna 401 com assinatura inválida', async () => {
      const charge = aCharge().awaitingPayment().build();
      chargeRepo.seed(charge);
      const rawJson = JSON.stringify(aWebhookEvent().confirmed().withChargeId(charge.id).build());

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('Content-Type', 'application/json')
        .set('X-Webhook-Signature', 'assinatura-errada')
        .send(rawJson);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.AUTHENTICATION_FAILED);
    });
  });

  describe('payment.confirmed', () => {
    it('retorna 200 e charge fica PAID', async () => {
      const charge = aCharge().awaitingPayment().build();
      chargeRepo.seed(charge);
      const rawJson = JSON.stringify(aWebhookEvent().confirmed().withChargeId(charge.id).build());

      const res = await signedPost(app, rawJson);

      expect(res.status).toBe(200);
      expect(chargeRepo.all().find((stored) => stored.id === charge.id)?.status).toBe(ChargeStatus.PAID);
    });
  });

  describe('payment.expired', () => {
    it('retorna 200 e charge fica EXPIRED', async () => {
      const charge = aCharge().awaitingPayment().build();
      chargeRepo.seed(charge);
      const rawJson = JSON.stringify(aWebhookEvent().expired().withChargeId(charge.id).build());

      const res = await signedPost(app, rawJson);

      expect(res.status).toBe(200);
      expect(chargeRepo.all().find((stored) => stored.id === charge.id)?.status).toBe(ChargeStatus.EXPIRED);
    });
  });

  describe('dedup — event_id duplicado', () => {
    it('retorna 200 e não altera o estado da charge na segunda chamada', async () => {
      const charge = aCharge().awaitingPayment().build();
      chargeRepo.seed(charge);
      const eventId = `evt-dedup-${faker.string.uuid()}`;
      const rawJson = JSON.stringify(
        aWebhookEvent().confirmed().withChargeId(charge.id).withEventId(eventId).build(),
      );

      await signedPost(app, rawJson).expect(200);
      expect(chargeRepo.all().find((stored) => stored.id === charge.id)?.status).toBe(ChargeStatus.PAID);

      const secondResponse = await signedPost(app, rawJson);
      expect(secondResponse.status).toBe(200);
      expect(chargeRepo.all().find((stored) => stored.id === charge.id)?.status).toBe(ChargeStatus.PAID);
    });
  });

  describe('charge inexistente', () => {
    it('retorna 404 quando charge_id não existe no repositório', async () => {
      const rawJson = JSON.stringify(aWebhookEvent().confirmed().build());

      const res = await signedPost(app, rawJson);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(ErrorCode.CHARGE_NOT_FOUND);
    });
  });

  describe('transição de estado inválida', () => {
    it('retorna 409 ao enviar payment.expired para charge já PAID', async () => {
      const charge = aCharge().paid().build();
      chargeRepo.seed(charge);
      const rawJson = JSON.stringify(
        aWebhookEvent().expired().withChargeId(charge.id).withEventId(`evt-invalid-${faker.string.uuid()}`).build(),
      );

      const res = await signedPost(app, rawJson);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
    });
  });

  describe('validação de payload (Zod)', () => {
    it('retorna 400 para body sem charge_id', async () => {
      const rawJson = JSON.stringify({
        event_id: `evt-${faker.string.uuid()}`,
        type: 'payment.confirmed',
        occurred_at: new Date().toISOString(),
      });

      const res = await signedPost(app, rawJson);

      expect(res.status).toBe(400);
    });

    it('retorna 400 para tipo de evento não reconhecido pelo schema', async () => {
      const rawJson = JSON.stringify({
        event_id: `evt-${faker.string.uuid()}`,
        type: 'payment.refunded',
        charge_id: faker.string.uuid(),
        occurred_at: new Date().toISOString(),
      });

      const res = await signedPost(app, rawJson);

      expect(res.status).toBe(400);
    });
  });
});
