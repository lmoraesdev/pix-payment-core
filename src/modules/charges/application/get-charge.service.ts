import { Injectable } from '@nestjs/common';
import { ChargeResponseDto } from './dto/charge-response.dto';

@Injectable()
export class GetChargeService {
  async execute(_id: string): Promise<ChargeResponseDto> {
    // TODO: implement next session
    // 1. ChargeRepository.findById (throw 404 if not found)
    // 2. Map Charge → ChargeResponseDto
    throw new Error('Not implemented');
  }
}
