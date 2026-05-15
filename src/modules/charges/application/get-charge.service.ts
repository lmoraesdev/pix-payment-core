import { Injectable } from '@nestjs/common';
import { ChargeResponseDto } from './dto/charge-response.dto';
import { ChargeRepository } from '@/modules/charges/infrastructure/charge.repository';
import { ChargeNotFoundError } from '@/modules/charges/domain/charge-not-found.error';

@Injectable()
export class GetChargeService {
  constructor(private readonly chargeRepository: ChargeRepository) {}

  async execute(id: string): Promise<ChargeResponseDto> {
    const charge = await this.chargeRepository.findById(id);
    if (!charge) {
      throw new ChargeNotFoundError(id);
    }
    return {
      id: charge.id,
      status: charge.status,
      amount: charge.amount,
      currency: charge.currency,
      qr_code: charge.qrCode,
      expires_at: charge.expiresAt,
      created_at: charge.createdAt,
    };
  }
}
