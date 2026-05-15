import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateChargeService } from '../application/create-charge.service';
import { ChargeResponseDto } from '../application/dto/charge-response.dto';
import { CreateChargeDto } from '../application/dto/create-charge.dto';
import { GetChargeService } from '../application/get-charge.service';

@Controller('charges')
export class ChargesController {
  constructor(
    private readonly createChargeService: CreateChargeService,
    private readonly getChargeService: GetChargeService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateChargeDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChargeResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const { data, created } = await this.createChargeService.execute(
      dto,
      idempotencyKey,
    );

    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return data;
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ChargeResponseDto> {
    return this.getChargeService.execute(id);
  }
}
