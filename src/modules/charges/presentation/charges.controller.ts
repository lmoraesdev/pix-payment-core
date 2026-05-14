import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { CreateChargeDto } from '../application/dto/create-charge.dto';
import { ChargeResponseDto } from '../application/dto/charge-response.dto';
import { CreateChargeService } from '../application/create-charge.service';
import { GetChargeService } from '../application/get-charge.service';

@Controller('charges')
export class ChargesController {
  constructor(
    private readonly createChargeService: CreateChargeService,
    private readonly getChargeService: GetChargeService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateChargeDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<ChargeResponseDto> {
    return this.createChargeService.execute(dto, idempotencyKey);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ChargeResponseDto> {
    return this.getChargeService.execute(id);
  }
}
