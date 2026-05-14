import { Injectable } from '@nestjs/common';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ChargeResponseDto } from './dto/charge-response.dto';

@Injectable()
export class CreateChargeService {
  async execute(
    _dto: CreateChargeDto,
    _idempotencyKey: string,
  ): Promise<ChargeResponseDto> {
    // TODO: implement next session
    // 1. Check idempotency key (IdempotencyRepository.findByKey)
    // 2. If found + hash matches → return cached response
    // 3. If found + hash differs → throw 422
    // 4. Build Charge entity, transition CREATED → AWAITING_PAYMENT
    // 5. Persist charge + idempotency key in a transaction
    // 6. Return ChargeResponseDto
    throw new Error('Not implemented');
  }
}
