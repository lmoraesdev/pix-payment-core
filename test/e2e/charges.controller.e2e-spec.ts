import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { DomainExceptionFilter } from '@/shared/filters/domain-exception.filter';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CreateChargeService } from '@/modules/charges/application/create-charge.service';
import { GetChargeService } from '@/modules/charges/application/get-charge.service';
import { Charge } from '@/modules/charges/domain/charge.entity';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { IdempotencyKey } from '@/modules/charges/infrastructure/idempotency-key.entity';
import { IdempotencyRepository } from '@/modules/charges/infrastructure/idempotency.repository';
import { ChargesController } from '@/modules/charges/presentation/charges.controller';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

class InMemoryChargeRepository {
  private store = new Map<string, Charge>();

  async findById(id: string): Promise<Charge | null> {
    return this.store.get(id) ?? null;
  }

  async save(charge: Charge): Promise<Charge> {
    this.store.set(charge.id, charge);
    return charge;
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

const validBody = {
  amount: 10000,
  currency: 'BRL',
  payer_document: '12345678901',
  description: 'Consulta médica',
};

describe('ChargesController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChargesController],
      providers: [
        StructuredLoggerService,
        CreateChargeService,
        GetChargeService,
        { provide: ChargeRepository, useClass: InMemoryChargeRepository },
        { provide: IdempotencyRepository, useClass: InMemoryIdempotencyRepository },
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

  describe('POST /charges', () => {
    it('cria a charge e retorna 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('idempotency-key', uuidv4())
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        status: 'AWAITING_PAYMENT',
        amount: 10000,
        currency: 'BRL',
      });
      expect(res.body.id).toBeDefined();
    });

    it('retorna 400 quando o header Idempotency-Key está ausente', async () => {
      const res = await request(app.getHttpServer()).post('/charges').send(validBody);

      expect(res.status).toBe(400);
    });

    it('retorna 400 quando amount é negativo (validação Zod)', async () => {
      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('Idempotency-Key', 'idem-test-invalid')
        .send({ amount: -100, currency: 'BRL', payer_document: '12345678901' });

      expect(res.status).toBe(400);
    });

    it('retorna 400 quando currency está ausente (validação Zod)', async () => {
      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('Idempotency-Key', 'idem-test-missing-field')
        .send({ amount: 1000, payer_document: '12345678901' });

      expect(res.status).toBe(400);
    });

    it('retorna 200 com a mesma resposta em chamada duplicada com mesmo body', async () => {
      const key = uuidv4();

      const first = await request(app.getHttpServer())
        .post('/charges')
        .set('idempotency-key', key)
        .send(validBody);

      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post('/charges')
        .set('idempotency-key', key)
        .send(validBody);

      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    });

    it('retorna 422 com mesma key e body diferente', async () => {
      const key = uuidv4();

      await request(app.getHttpServer())
        .post('/charges')
        .set('idempotency-key', key)
        .send(validBody)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('idempotency-key', key)
        .send({ ...validBody, amount: 99999 });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  describe('GET /charges/:id', () => {
    it('retorna 200 com a charge quando ela existe', async () => {
      const key = uuidv4();

      const created = await request(app.getHttpServer())
        .post('/charges')
        .set('idempotency-key', key)
        .send(validBody)
        .expect(201);

      const id = created.body.id as string;

      const res = await request(app.getHttpServer()).get(`/charges/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it('retorna 404 quando a charge não existe', async () => {
      const res = await request(app.getHttpServer()).get(
        '/charges/00000000-0000-4000-8000-000000000000',
      );

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CHARGE_NOT_FOUND');
    });

    it('retorna 400 quando o id não é um UUID válido', async () => {
      const res = await request(app.getHttpServer()).get('/charges/id-invalido');

      expect(res.status).toBe(400);
    });
  });
});
