import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessWebhookService } from '../../src/modules/webhooks/application/process-webhook.service';
import { WebhookEventAlreadyProcessedError } from '../../src/modules/webhooks/domain/webhook-event-already-processed.error';
import { ChargeStateMachine, InvalidStateTransitionError } from '../../src/modules/charges/domain/charge-state-machine';
import { ChargeNotFoundError } from '../../src/modules/charges/domain/charge-not-found.error';
import { ChargeStatus } from '../../src/modules/charges/domain/charge-status.enum';
import type { ChargeRepository } from '../../src/modules/charges/infrastructure/charge.repository';
import type { WebhookEventRepository } from '../../src/modules/webhooks/infrastructure/webhook-event.repository';
import type { Charge } from '../../src/modules/charges/domain/charge.entity';
import type { WebhookEventDto } from '../../src/modules/webhooks/application/dto/webhook-event.dto';

function makeCharge(status: ChargeStatus): Charge {
  const charge = {
    id: 'charge-uuid-1',
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

function makeDto(
  overrides: Partial<{
    event_id: string;
    type: 'payment.confirmed' | 'payment.expired';
    charge_id: string;
    occurred_at: string;
  }> = {},
): WebhookEventDto {
  return {
    event_id: 'evt-abc-123',
    type: 'payment.confirmed',
    charge_id: 'charge-uuid-1',
    occurred_at: '2026-01-02T00:00:00Z',
    ...overrides,
  } as unknown as WebhookEventDto;
}

describe('ProcessWebhookService', () => {
  let service: ProcessWebhookService;
  let chargeRepo: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let webhookEventRepo: {
    markAsProcessed: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    chargeRepo = { findById: vi.fn(), save: vi.fn() };
    webhookEventRepo = { markAsProcessed: vi.fn() };
    service = new ProcessWebhookService(
      chargeRepo as unknown as ChargeRepository,
      webhookEventRepo as unknown as WebhookEventRepository,
    );
  });

  describe('payment.confirmed', () => {
    it('muda charge de AWAITING_PAYMENT para PAID', async () => {
      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findById.mockResolvedValue(makeCharge(ChargeStatus.AWAITING_PAYMENT));
      chargeRepo.save.mockImplementation(async (c: Charge) => c);

      await service.execute(makeDto({ type: 'payment.confirmed' }));

      const [saved] = chargeRepo.save.mock.calls[0] as [Charge];
      expect(saved.status).toBe(ChargeStatus.PAID);
    });
  });

  describe('payment.expired', () => {
    it('muda charge de AWAITING_PAYMENT para EXPIRED', async () => {
      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findById.mockResolvedValue(makeCharge(ChargeStatus.AWAITING_PAYMENT));
      chargeRepo.save.mockImplementation(async (c: Charge) => c);

      await service.execute(makeDto({ type: 'payment.expired' }));

      const [saved] = chargeRepo.save.mock.calls[0] as [Charge];
      expect(saved.status).toBe(ChargeStatus.EXPIRED);
    });
  });

  describe('dedup — evento duplicado', () => {
    it('retorna sem efeito quando event_id já foi processado', async () => {
      webhookEventRepo.markAsProcessed.mockRejectedValue(
        new WebhookEventAlreadyProcessedError('evt-abc-123'),
      );

      await service.execute(makeDto());

      expect(chargeRepo.findById).not.toHaveBeenCalled();
      expect(chargeRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('charge inexistente', () => {
    it('lança ChargeNotFoundError quando charge_id não existe', async () => {
      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findById.mockResolvedValue(null);

      await expect(service.execute(makeDto())).rejects.toThrow(ChargeNotFoundError);
    });

    it('o erro carrega o charge_id não encontrado', async () => {
      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findById.mockResolvedValue(null);

      await expect(service.execute(makeDto({ charge_id: 'missing-id' }))).rejects.toSatisfy(
        (e: unknown): e is ChargeNotFoundError =>
          e instanceof ChargeNotFoundError && e.id === 'missing-id',
      );
    });
  });

  describe('tipo de evento desconhecido', () => {
    it('lança erro para tipo não mapeado', async () => {
      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findById.mockResolvedValue(makeCharge(ChargeStatus.AWAITING_PAYMENT));

      await expect(
        service.execute(makeDto({ type: 'payment.refunded' as never })),
      ).rejects.toThrow(Error);
    });
  });

  describe('transição inválida (InvalidStateTransitionError)', () => {
    it('lança InvalidStateTransitionError para charge já PAID recebendo payment.expired', async () => {
      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findById.mockResolvedValue(makeCharge(ChargeStatus.PAID));

      await expect(
        service.execute(makeDto({ type: 'payment.expired' })),
      ).rejects.toThrow(InvalidStateTransitionError);
    });

    it('não persiste a charge quando a transição é inválida', async () => {
      webhookEventRepo.markAsProcessed.mockResolvedValue(undefined);
      chargeRepo.findById.mockResolvedValue(makeCharge(ChargeStatus.PAID));

      await expect(
        service.execute(makeDto({ type: 'payment.expired' })),
      ).rejects.toThrow(InvalidStateTransitionError);

      expect(chargeRepo.save).not.toHaveBeenCalled();
    });
  });
});
