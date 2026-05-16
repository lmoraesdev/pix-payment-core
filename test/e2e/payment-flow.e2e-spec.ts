import { createHmac } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

import { CreateChargeService } from '@/modules/charges/application/create-charge.service';
import { GetChargeService } from '@/modules/charges/application/get-charge.service';
import { ChargeStateMachine } from '@/modules/charges/domain/charge-state-machine';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { Charge } from '@/modules/charges/domain/charge.entity';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { IdempotencyKey } from '@/modules/charges/infrastructure/idempotency-key.entity';
import { IdempotencyRepository } from '@/modules/charges/infrastructure/idempotency.repository';
import { ChargesController } from '@/modules/charges/presentation/charges.controller';
import { ProcessWebhookService } from '@/modules/webhooks/application/process-webhook.service';
import { WebhookEventAlreadyProcessedError } from '@/modules/webhooks/domain/webhook-event-already-processed.error';
import { WebhookEventRepository } from '@/modules/webhooks/infrastructure/webhook-event.repository';
import { WebhooksController } from '@/modules/webhooks/presentation/webhooks.controller';
import { DomainExceptionFilter } from '@/shared/filters/domain-exception.filter';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

// ─── In-memory repositories ───────────────────────────────────────────────────

class InMemoryChargeRepository {
  private store = new Map<string, Charge>();

  async findById(id: string): Promise<Charge | null> {
    return this.store.get(id) ?? null;
  }

  async save(charge: Charge): Promise<Charge> {
    this.store.set(charge.id, { ...charge } as Charge);
    return this.store.get(charge.id)!;
  }
}

class InMemoryIdempotencyRepository {
  private store = new Map<string, IdempotencyKey>();

  async findByKey(key: string): Promise<IdempotencyKey | null> {
    return this.store.get(key) ?? null;
  }

  async save(record: IdempotencyKey): Promise<IdempotencyKey> {
    this.store.set(record.key, record);
    return record;
  }
}

class InMemoryWebhookEventRepository {
  private processed = new Set<string>();

  async markAsProcessed(eventId: string): Promise<void> {
    if (this.processed.has(eventId)) throw new WebhookEventAlreadyProcessedError(eventId);
    this.processed.add(eventId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-webhook-secret';

function sign(rawJson: string): string {
  return createHmac('sha256', TEST_SECRET).update(rawJson).digest('hex');
}

// The InMemoryChargeRepository above stores plain objects ({...charge}), so
// transitionTo would be missing. We patch save to preserve the method from the
// entity prototype so the shared repo works across both services.
function patchSave(repo: InMemoryChargeRepository): InMemoryChargeRepository {
  const original = repo.save.bind(repo);
  repo.save = async (charge: Charge): Promise<Charge> => {
    const stored = await original(charge);
    stored.transitionTo = (next: ChargeStatus): void => {
      stored.status = new ChargeStateMachine(stored.status).transitionTo(next);
    };
    return stored;
  };
  return repo;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Payment flow — happy path (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env['WEBHOOK_SECRET'] = TEST_SECRET;

    const chargeRepo = patchSave(new InMemoryChargeRepository());
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
    // Step 1 — create charge
    const createRes = await request(app.getHttpServer())
      .post('/charges')
      .set('Idempotency-Key', uuidv4())
      .set('Content-Type', 'application/json')
      .send({
        amount: 15000,
        currency: 'BRL',
        payer_document: '98765432100',
        description: 'E2E happy path',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('AWAITING_PAYMENT');

    const chargeId: string = createRes.body.id as string;
    expect(chargeId).toBeDefined();

    // Step 2 — verify initial status
    const getRes1 = await request(app.getHttpServer()).get(`/charges/${chargeId}`);

    expect(getRes1.status).toBe(200);
    expect(getRes1.body.status).toBe('AWAITING_PAYMENT');

    // Step 3 — send payment.confirmed webhook
    const webhookPayload = JSON.stringify({
      event_id: `evt-${uuidv4()}`,
      type: 'payment.confirmed',
      charge_id: chargeId,
      occurred_at: new Date().toISOString(),
    });

    const webhookRes = await request(app.getHttpServer())
      .post('/webhooks/provider')
      .set('Content-Type', 'application/json')
      .set('X-Webhook-Signature', sign(webhookPayload))
      .send(webhookPayload);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.received).toBe(true);

    // Step 4 — verify charge is now PAID
    const getRes2 = await request(app.getHttpServer()).get(`/charges/${chargeId}`);

    expect(getRes2.status).toBe(200);
    expect(getRes2.body.status).toBe('PAID');
  });
});
