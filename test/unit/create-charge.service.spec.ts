import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { CreateChargeService } from '@/modules/charges/application/create-charge.service';
import { IdempotencyConflictError } from '@/modules/charges/domain/idempotency-conflict.error';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import type { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import type { IdempotencyRepository } from '@/modules/charges/infrastructure/idempotency.repository';
import type { CreateChargeDto } from '@/modules/charges/application/dto/create-charge.dto';
import type { Charge } from '@/modules/charges/domain/charge.entity';
import type { IdempotencyKey } from '@/modules/charges/infrastructure/idempotency-key.entity';
import type { ChargeResponseDto } from '@/modules/charges/application/dto/charge-response.dto';

// SHA-256 de JSON com chaves ordenadas alfabeticamente — define o contrato
// sem depender da implementação (o serviço deve chegar ao mesmo resultado)
function canonicalHash(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256')
    .update(JSON.stringify(Object.fromEntries(entries)))
    .digest('hex');
}

const KEY = 'idem-key-abc';

const dto = {
  amount: 10000,
  currency: 'BRL',
  payer_document: '12345678901',
  description: 'Consulta médica',
} as unknown as CreateChargeDto;

const savedCharge = {
  id: 'charge-uuid-1',
  status: ChargeStatus.AWAITING_PAYMENT,
  amount: 10000,
  currency: 'BRL',
  qrCode: null,
  expiresAt: null,
  createdAt: new Date('2026-01-01'),
} as unknown as Charge;

const cachedResponse: ChargeResponseDto = {
  id: 'charge-uuid-1',
  status: ChargeStatus.AWAITING_PAYMENT,
  amount: 10000,
  currency: 'BRL',
  qr_code: null,
  expires_at: null,
  created_at: new Date('2026-01-01'),
};

describe('CreateChargeService', () => {
  let service: CreateChargeService;
  let chargeRepo: { save: ReturnType<typeof vi.fn> };
  let idempotencyRepo: {
    findByKey: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    chargeRepo = { save: vi.fn() };
    idempotencyRepo = { findByKey: vi.fn(), save: vi.fn() };
    service = new CreateChargeService(
      chargeRepo as unknown as ChargeRepository,
      idempotencyRepo as unknown as IdempotencyRepository,
    );
  });

  describe('primeira chamada — key nova', () => {
    beforeEach(() => {
      idempotencyRepo.findByKey.mockResolvedValue(null);
      chargeRepo.save.mockResolvedValue(savedCharge);
      idempotencyRepo.save.mockImplementation(async (r: IdempotencyKey) => r);
    });

    it('persiste a charge no repositório', async () => {
      await service.execute(dto, KEY);
      expect(chargeRepo.save).toHaveBeenCalledOnce();
    });

    it('persiste a idempotency key com a key, o hash e a response', async () => {
      await service.execute(dto, KEY);

      const [record] = idempotencyRepo.save.mock.calls[0] as [IdempotencyKey];
      expect(record.key).toBe(KEY);
      expect(record.requestHash).toBe(canonicalHash(dto as unknown as Record<string, unknown>));
      expect(record.responseBody).toMatchObject({ id: 'charge-uuid-1' });
    });

    it('retorna created: true na primeira chamada', async () => {
      const result = await service.execute(dto, KEY);
      expect(result.created).toBe(true);
    });

    it('retorna ChargeResponseDto com status AWAITING_PAYMENT e created: true', async () => {
      const result = await service.execute(dto, KEY);
      expect(result.data.id).toBe('charge-uuid-1');
      expect(result.data.status).toBe(ChargeStatus.AWAITING_PAYMENT);
      expect(result.created).toBe(true);
    });
  });

  describe('segunda chamada — mesma key + mesmo hash (cache hit)', () => {
    it('retorna a resposta cacheada sem criar nova charge', async () => {
      const existing = {
        key: KEY,
        chargeId: 'charge-uuid-1',
        requestHash: canonicalHash(dto as unknown as Record<string, unknown>),
        responseBody: cachedResponse as unknown as Record<string, unknown>,
        createdAt: new Date(),
      } as IdempotencyKey;
      idempotencyRepo.findByKey.mockResolvedValue(existing);

      const result = await service.execute(dto, KEY);

      expect(chargeRepo.save).not.toHaveBeenCalled();
      expect(idempotencyRepo.save).not.toHaveBeenCalled();
      expect(result.data).toEqual(cachedResponse);
      expect(result.created).toBe(false);
    });
  });

  describe('segunda chamada — mesma key + hash diferente (conflito)', () => {
    beforeEach(() => {
      idempotencyRepo.findByKey.mockResolvedValue({
        key: KEY,
        chargeId: 'charge-uuid-1',
        requestHash: 'hash-completamente-diferente',
        responseBody: {},
        createdAt: new Date(),
      } as IdempotencyKey);
    });

    it('lança IdempotencyConflictError', async () => {
      await expect(service.execute(dto, KEY)).rejects.toThrow(IdempotencyConflictError);
    });

    it('o erro expõe a key conflitante', async () => {
      await expect(service.execute(dto, KEY)).rejects.toSatisfy(
        (e: unknown): e is IdempotencyConflictError =>
          e instanceof IdempotencyConflictError && e.key === KEY,
      );
    });

    it('não cria charge nem persiste key quando há conflito', async () => {
      await expect(service.execute(dto, KEY)).rejects.toThrow(IdempotencyConflictError);
      expect(chargeRepo.save).not.toHaveBeenCalled();
      expect(idempotencyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('canonicalização do hash', () => {
    beforeEach(() => {
      idempotencyRepo.findByKey.mockResolvedValue(null);
      chargeRepo.save.mockResolvedValue(savedCharge);
      idempotencyRepo.save.mockImplementation(async (r: IdempotencyKey) => r);
    });

    it('DTOs com mesmas chaves em ordens diferentes produzem o mesmo hash', async () => {
      const dtoOrdemA = {
        amount: 100,
        currency: 'BRL',
        payer_document: '12345678901',
      } as unknown as CreateChargeDto;
      const dtoOrdemB = {
        payer_document: '12345678901',
        amount: 100,
        currency: 'BRL',
      } as unknown as CreateChargeDto;

      await service.execute(dtoOrdemA, 'key-a');
      const hashA = (idempotencyRepo.save.mock.calls[0][0] as IdempotencyKey).requestHash;

      vi.clearAllMocks();
      idempotencyRepo.findByKey.mockResolvedValue(null);
      chargeRepo.save.mockResolvedValue(savedCharge);
      idempotencyRepo.save.mockImplementation(async (r: IdempotencyKey) => r);

      await service.execute(dtoOrdemB, 'key-b');
      const hashB = (idempotencyRepo.save.mock.calls[0][0] as IdempotencyKey).requestHash;

      expect(hashA).toBe(hashB);
    });

    it('DTOs com valores diferentes produzem hashes diferentes', async () => {
      const dtoA = {
        amount: 100,
        currency: 'BRL',
      } as unknown as CreateChargeDto;
      const dtoB = {
        amount: 200,
        currency: 'BRL',
      } as unknown as CreateChargeDto;

      await service.execute(dtoA, 'key-a');
      const hashA = (idempotencyRepo.save.mock.calls[0][0] as IdempotencyKey).requestHash;

      vi.clearAllMocks();
      idempotencyRepo.findByKey.mockResolvedValue(null);
      chargeRepo.save.mockResolvedValue(savedCharge);
      idempotencyRepo.save.mockImplementation(async (r: IdempotencyKey) => r);

      await service.execute(dtoB, 'key-b');
      const hashB = (idempotencyRepo.save.mock.calls[0][0] as IdempotencyKey).requestHash;

      expect(hashA).not.toBe(hashB);
    });
  });
});
