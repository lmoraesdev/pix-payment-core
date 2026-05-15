import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetChargeService } from '../../src/modules/charges/application/get-charge.service';
import { ChargeNotFoundError } from '../../src/modules/charges/domain/charge-not-found.error';
import { ChargeStatus } from '../../src/modules/charges/domain/charge-status.enum';
import type { ChargeRepository } from '../../src/modules/charges/infrastructure/charge.repository';
import type { Charge } from '../../src/modules/charges/domain/charge.entity';

const storedCharge = {
  id: 'charge-uuid-1',
  status: ChargeStatus.AWAITING_PAYMENT,
  amount: 10000,
  currency: 'BRL',
  payerDocument: '12345678901',
  description: null,
  qrCode: null,
  expiresAt: null,
  createdAt: new Date('2026-01-01'),
} as unknown as Charge;

describe('GetChargeService', () => {
  let service: GetChargeService;
  let chargeRepo: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    chargeRepo = { findById: vi.fn() };
    service = new GetChargeService(chargeRepo as unknown as ChargeRepository);
  });

  it('retorna ChargeResponseDto quando a charge existe', async () => {
    chargeRepo.findById.mockResolvedValue(storedCharge);

    const result = await service.execute('charge-uuid-1');

    expect(result).toEqual({
      id: 'charge-uuid-1',
      status: ChargeStatus.AWAITING_PAYMENT,
      amount: 10000,
      currency: 'BRL',
      qr_code: null,
      expires_at: null,
      created_at: new Date('2026-01-01'),
    });
  });

  it('lança ChargeNotFoundError quando a charge não existe', async () => {
    chargeRepo.findById.mockResolvedValue(null);

    await expect(service.execute('id-inexistente')).rejects.toThrow(
      ChargeNotFoundError,
    );
  });

  it('o erro carrega o id da charge não encontrada', async () => {
    chargeRepo.findById.mockResolvedValue(null);

    await expect(service.execute('id-faltante')).rejects.toSatisfy(
      (e: unknown): e is ChargeNotFoundError =>
        e instanceof ChargeNotFoundError && e.id === 'id-faltante',
    );
  });
});
