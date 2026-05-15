import { createHmac } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessWebhookService } from '../../src/modules/webhooks/application/process-webhook.service';
import { WebhookEventAlreadyProcessedError } from '../../src/modules/webhooks/domain/webhook-event-already-processed.error';
import { WebhookEventRepository } from '../../src/modules/webhooks/infrastructure/webhook-event.repository';
import { WebhooksController } from '../../src/modules/webhooks/presentation/webhooks.controller';
import { ChargeStateMachine } from '../../src/modules/charges/domain/charge-state-machine';
import { ChargeStatus } from '../../src/modules/charges/domain/charge-status.enum';
import { ChargeRepository } from '../../src/modules/charges/infrastructure/charge.repository';
import { DomainExceptionFilter } from '../../src/shared/filters/domain-exception.filter';
import type { Charge } from '../../src/modules/charges/domain/charge.entity';

// ─── Infra ────────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-webhook-secret';

function sign(body: object): string {
  return createHmac('sha256', TEST_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
}

function makeCharge(id: string, status: ChargeStatus): Charge {
  const charge = {
    id,
    status,
    amount: 10000,
    currency: 'BRL',
    payerDocument: '12345678901',
    description: null,
    qrCode: null,
    expiresAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  } as Partial<Charge>;
  charge.transitionTo = (next: ChargeStatus): void => {
    charge.status = new ChargeStateMachine(charge.status!).transitionTo(next);
  };
  return charge as Charge;
}

class InMemoryChargeRepository {
  private store = new Map<string, Charge>();

  seed(charge: Charge): void {
    this.store.set(charge.id, charge);
  }

  async findById(id: string): Promise<Charge | null> {
    return this.store.get(id) ?? null;
  }

  async save(charge: Charge): Promise<Charge> {
    this.store.set(charge.id, charge);
    return charge;
  }
}

class InMemoryWebhookEventRepository {
  private processed = new Set<string>();

  async markAsProcessed(eventId: string): Promise<void> {
    if (this.processed.has(eventId)) {
      throw new WebhookEventAlreadyProcessedError(eventId);
    }
    this.processed.add(eventId);
  }
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function confirmedBody(chargeId: string, eventId = 'evt-001') {
  return {
    event_id: eventId,
    type: 'payment.confirmed' as const,
    charge_id: chargeId,
    occurred_at: '2026-01-02T00:00:00Z',
  };
}

function expiredBody(chargeId: string, eventId = 'evt-002') {
  return {
    event_id: eventId,
    type: 'payment.expired' as const,
    charge_id: chargeId,
    occurred_at: '2026-01-02T00:00:00Z',
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

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
        ProcessWebhookService,
        { provide: ChargeRepository, useValue: chargeRepo },
        { provide: WebhookEventRepository, useValue: webhookEventRepo },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ─── Autenticação ───────────────────────────────────────────────────────────

  describe('assinatura HMAC', () => {
    it('retorna 401 sem header X-Webhook-Signature', async () => {
      chargeRepo.seed(makeCharge('charge-1', ChargeStatus.AWAITING_PAYMENT));
      const body = confirmedBody('charge-1');

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .send(body);

      expect(res.status).toBe(401);
    });

    it('retorna 401 com assinatura inválida', async () => {
      chargeRepo.seed(makeCharge('charge-1', ChargeStatus.AWAITING_PAYMENT));
      const body = confirmedBody('charge-1');

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', 'assinatura-errada')
        .send(body);

      expect(res.status).toBe(401);
    });
  });

  // ─── Fluxos funcionais ──────────────────────────────────────────────────────

  describe('payment.confirmed', () => {
    it('retorna 200 e charge fica PAID', async () => {
      const charge = makeCharge('charge-1', ChargeStatus.AWAITING_PAYMENT);
      chargeRepo.seed(charge);
      const body = confirmedBody('charge-1');

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', sign(body))
        .send(body);

      expect(res.status).toBe(200);
      expect(charge.status).toBe(ChargeStatus.PAID);
    });
  });

  describe('payment.expired', () => {
    it('retorna 200 e charge fica EXPIRED', async () => {
      const charge = makeCharge('charge-1', ChargeStatus.AWAITING_PAYMENT);
      chargeRepo.seed(charge);
      const body = expiredBody('charge-1');

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', sign(body))
        .send(body);

      expect(res.status).toBe(200);
      expect(charge.status).toBe(ChargeStatus.EXPIRED);
    });
  });

  describe('dedup — event_id duplicado', () => {
    it('retorna 200 e não altera o estado da charge na segunda chamada', async () => {
      const charge = makeCharge('charge-1', ChargeStatus.AWAITING_PAYMENT);
      chargeRepo.seed(charge);
      const body = confirmedBody('charge-1', 'evt-dedup');

      await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', sign(body))
        .send(body)
        .expect(200);

      expect(charge.status).toBe(ChargeStatus.PAID);

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', sign(body))
        .send(body);

      expect(res.status).toBe(200);
      // status não reverteu — a charge continua PAID após o replay
      expect(charge.status).toBe(ChargeStatus.PAID);
    });
  });

  describe('charge inexistente', () => {
    it('retorna 404 quando charge_id não existe no repositório', async () => {
      const body = confirmedBody('charge-nao-existe');

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', sign(body))
        .send(body);

      expect(res.status).toBe(404);
    });
  });

  describe('transição de estado inválida', () => {
    it('retorna 409 ao enviar payment.expired para charge já PAID', async () => {
      chargeRepo.seed(makeCharge('charge-1', ChargeStatus.PAID));
      const body = expiredBody('charge-1', 'evt-invalid-transition');

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', sign(body))
        .send(body);

      expect(res.status).toBe(409);
    });
  });

  // ─── Validação Zod ──────────────────────────────────────────────────────────

  describe('validação de payload (Zod)', () => {
    it('retorna 400 para body sem charge_id', async () => {
      const body = { event_id: 'evt-bad', type: 'payment.confirmed', occurred_at: '2026-01-02T00:00:00Z' };

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', sign(body))
        .send(body);

      expect(res.status).toBe(400);
    });

    it('retorna 400 para tipo de evento não reconhecido pelo schema', async () => {
      // O schema Zod define `type` como enum estrito de ["payment.confirmed", "payment.expired"].
      // Qualquer outro valor é rejeitado pelo ZodValidationPipe antes de chegar ao service —
      // por isso 400 (falha de validação de entrada), e não 422 (conflito de negócio) nem
      // 500 (erro não tratado do map interno do service).
      const body = {
        event_id: 'evt-unknown',
        type: 'payment.refunded',
        charge_id: 'charge-1',
        occurred_at: '2026-01-02T00:00:00Z',
      };

      const res = await request(app.getHttpServer())
        .post('/webhooks/provider')
        .set('X-Webhook-Signature', sign(body))
        .send(body);

      expect(res.status).toBe(400);
    });
  });
});
