import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CreateChargeService } from '@/modules/charges/application/create-charge.service';
import { ChargeResponseDto } from '@/modules/charges/application/dto/charge-response.dto';
import { CreateChargeDto } from '@/modules/charges/application/dto/create-charge.dto';
import { GetChargeService } from '@/modules/charges/application/get-charge.service';

@ApiTags('charges')
@Controller('charges')
export class ChargesController {
  constructor(
    private readonly createChargeService: CreateChargeService,
    private readonly getChargeService: GetChargeService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a Pix charge',
    description:
      'Creates a new charge. Requires Idempotency-Key header. ' +
      'Retrying with the same key and body returns the original response (200). ' +
      'Same key with different body returns 422.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key to make the request idempotent',
  })
  @ApiResponse({ status: 201, description: 'Charge created' })
  @ApiResponse({ status: 200, description: 'Idempotent retry — cached response' })
  @ApiResponse({ status: 400, description: 'Missing Idempotency-Key or invalid body' })
  @ApiResponse({ status: 422, description: 'Idempotency-Key reused with different body' })
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
  @ApiOperation({ summary: 'Get a charge by id' })
  @ApiResponse({ status: 200, description: 'Charge found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 404, description: 'Charge not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ChargeResponseDto> {
    return this.getChargeService.execute(id);
  }
}
