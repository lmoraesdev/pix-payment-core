import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';
import { DomainError } from '@/shared/errors/domain.error';
import { Charge } from '@/modules/charges/domain/charge.entity';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';
import { IdempotencyConflictError } from '@/modules/charges/domain/idempotency-conflict.error';
import { IdempotencyKey } from '@/modules/charges/infrastructure/idempotency-key.entity';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { IdempotencyRepository } from '@/modules/charges/infrastructure/idempotency.repository';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ChargeResponseDto } from './dto/charge-response.dto';

export interface CreateChargeResult {
  data: ChargeResponseDto;
  created: boolean;
}

@Injectable()
export class CreateChargeService {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly chargeRepository: ChargeRepository,
    private readonly idempotencyRepository: IdempotencyRepository,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger.forContext('CreateChargeService');
  }

  async execute(request: CreateChargeDto, idempotencyKey: string): Promise<CreateChargeResult> {
    try {
      return await this._execute(request, idempotencyKey);
    } catch (err) {
      if (err instanceof DomainError) throw err;
      this.logger.error(
        {
          what: 'create_charge_failed',
          why: 'unexpected_error',
          how: 'POST /charges',
          key: idempotencyKey,
          message: (err as Error).message,
        },
        (err as Error).stack,
      );
      throw err;
    }
  }

  private async _execute(request: CreateChargeDto, idempotencyKey: string): Promise<CreateChargeResult> {
    const requestHash = this.canonicalHash(request as unknown as Record<string, unknown>);

    const existingRecord = await this.idempotencyRepository.findByKey(idempotencyKey);

    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        this.logger.warn({
          what: 'idempotency_conflict',
          why: 'key_reused_with_different_body',
          how: 'POST /charges',
          key: idempotencyKey,
        });
        throw new IdempotencyConflictError(idempotencyKey);
      }

      this.logger.log({
        what: 'idempotency_cache_hit',
        why: 'duplicate_request',
        how: 'POST /charges',
        charge_id: existingRecord.chargeId,
      });

      return {
        data: existingRecord.responseBody as unknown as ChargeResponseDto,
        created: false,
      };
    }

    const newCharge = Object.assign(new Charge(), {
      id: uuidv4(),
      status: ChargeStatus.AWAITING_PAYMENT,
      amount: request.amount,
      currency: request.currency,
      payerDocument: request.payer_document,
      description: request.description ?? null,
      qrCode: null,
      expiresAt: null,
    });

    const savedCharge = await this.chargeRepository.save(newCharge);

    const response: ChargeResponseDto = {
      id: savedCharge.id,
      status: savedCharge.status,
      amount: savedCharge.amount,
      currency: savedCharge.currency,
      qr_code: savedCharge.qrCode,
      expires_at: savedCharge.expiresAt,
      created_at: savedCharge.createdAt,
    };

    this.logger.log({
      what: 'charge_created',
      why: 'user_request',
      how: 'POST /charges',
      who: request.payer_document,
      charge_id: savedCharge.id,
      amount: savedCharge.amount,
      currency: savedCharge.currency,
    });

    const idempotencyRecord = Object.assign(new IdempotencyKey(), {
      key: idempotencyKey,
      chargeId: savedCharge.id,
      requestHash,
      responseBody: response as unknown as Record<string, unknown>,
    });

    await this.idempotencyRepository.save(idempotencyRecord);

    return { data: response, created: true };
  }

  /**
   * Canonicalizes only top-level keys.
   * Nested objects must already be canonicalized by the caller.
   */
  private canonicalHash(payload: Record<string, unknown>): string {
    const sortedEntries = Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

    return createHash('sha256')
      .update(JSON.stringify(Object.fromEntries(sortedEntries)))
      .digest('hex');
  }
}
