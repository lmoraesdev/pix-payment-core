import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ChargeResponseDto } from './dto/charge-response.dto';
import { Charge } from '../domain/charge.entity';
import { ChargeStatus } from '../domain/charge-status.enum';
import { IdempotencyConflictError } from '../domain/idempotency-conflict.error';
import { IdempotencyKey } from '../infrastructure/idempotency-key.entity';
import { ChargeRepository } from '../infrastructure/charge.repository';
import { IdempotencyRepository } from '../infrastructure/idempotency.repository';

@Injectable()
export class CreateChargeService {
  constructor(
    private readonly chargeRepository: ChargeRepository,
    private readonly idempotencyRepository: IdempotencyRepository,
  ) {}

  async execute(
    request: CreateChargeDto,
    idempotencyKey: string,
  ): Promise<ChargeResponseDto> {
    const requestHash = this.canonicalHash(
      request as unknown as Record<string, unknown>,
    );

    const existingRecord =
      await this.idempotencyRepository.findByKey(idempotencyKey);

    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        throw new IdempotencyConflictError(idempotencyKey);
      }
      return existingRecord.responseBody as unknown as ChargeResponseDto;
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

    const idempotencyRecord = Object.assign(new IdempotencyKey(), {
      key: idempotencyKey,
      chargeId: savedCharge.id,
      requestHash,
      responseBody: response as unknown as Record<string, unknown>,
    });

    await this.idempotencyRepository.save(idempotencyRecord);

    return response;
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
