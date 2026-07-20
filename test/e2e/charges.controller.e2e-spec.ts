import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { DomainExceptionFilter } from '@/shared/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '@/shared/filters/validation-exception.filter';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import request from 'supertest';
import { faker } from '@faker-js/faker';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CreateChargeService } from '@/modules/charges/application/create-charge.service';
import { GetChargeService } from '@/modules/charges/application/get-charge.service';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { IdempotencyRepository } from '@/modules/charges/infrastructure/idempotency.repository';
import { ChargesController } from '@/modules/charges/presentation/charges.controller';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';
import { TransactionRunner } from '@/shared/database/transaction-runner';
import {
  InMemoryChargeRepository,
  InMemoryIdempotencyRepository,
} from '../fakes';
import { aCreateChargeDto } from '../builders';

const fakeTransactionRunner = { run: (work: (manager: undefined) => unknown) => work(undefined) };

describe('ChargesController (e2e)', () => {
  let app: INestApplication;
  const validBody = aCreateChargeDto().build();

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChargesController],
      providers: [
        StructuredLoggerService,
        CreateChargeService,
        GetChargeService,
        { provide: ChargeRepository, useClass: InMemoryChargeRepository },
        { provide: IdempotencyRepository, useClass: InMemoryIdempotencyRepository },
        { provide: TransactionRunner, useValue: fakeTransactionRunner },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
        { provide: APP_FILTER, useClass: ValidationExceptionFilter },
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
        .set('idempotency-key', faker.string.uuid())
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        status: 'AWAITING_PAYMENT',
        amount: validBody.amount,
        currency: 'BRL',
      });
      expect(res.body.id).toBeDefined();
    });

    it('retorna 400 quando o header Idempotency-Key está ausente', async () => {
      const res = await request(app.getHttpServer()).post('/charges').send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.MISSING_IDEMPOTENCY_KEY);
    });

    it('retorna 400 quando amount é negativo (validação Zod)', async () => {
      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('Idempotency-Key', faker.string.uuid())
        .send(aCreateChargeDto().withAmount(-100).build());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('retorna 400 quando amount excede o limite inteiro (validação Zod)', async () => {
      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('Idempotency-Key', faker.string.uuid())
        .send(aCreateChargeDto().withAmount(2147483648).build());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('retorna 400 quando amount é Number.MAX_SAFE_INTEGER (fora do range seguro)', async () => {
      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('Idempotency-Key', faker.string.uuid())
        .send(aCreateChargeDto().withAmount(Number.MAX_SAFE_INTEGER).build());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('retorna 400 quando currency está ausente (validação Zod)', async () => {
      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('Idempotency-Key', faker.string.uuid())
        .send(aCreateChargeDto().withoutCurrency().build());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('retorna 400 quando currency é inválida (não é BRL)', async () => {
      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('Idempotency-Key', faker.string.uuid())
        .send(aCreateChargeDto().withCurrency('USD').build());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('retorna 200 com a mesma resposta em chamada duplicada com mesmo body', async () => {
      const key = faker.string.uuid();

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
      const key = faker.string.uuid();

      await request(app.getHttpServer())
        .post('/charges')
        .set('idempotency-key', key)
        .send(validBody)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/charges')
        .set('idempotency-key', key)
        .send(aCreateChargeDto().withAmount(validBody.amount + 1).build());

      expect(res.status).toBe(422);
      expect(res.body.code).toBe(ErrorCode.IDEMPOTENCY_CONFLICT);
    });
  });

  describe('GET /charges/:id', () => {
    it('retorna 200 com a charge quando ela existe', async () => {
      const key = faker.string.uuid();

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
      expect(res.body.code).toBe(ErrorCode.CHARGE_NOT_FOUND);
    });

    it('retorna 400 quando o id não é um UUID válido', async () => {
      const res = await request(app.getHttpServer()).get('/charges/id-invalido');

      expect(res.status).toBe(400);
    });
  });
});
