import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Charge } from './domain/charge.entity';
import { IdempotencyKey } from './infrastructure/idempotency-key.entity';
import { ChargeRepository } from './infrastructure/charge.repository';
import { IdempotencyRepository } from './infrastructure/idempotency.repository';
import { CreateChargeService } from './application/create-charge.service';
import { GetChargeService } from './application/get-charge.service';
import { ChargesController } from './presentation/charges.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Charge, IdempotencyKey])],
  controllers: [ChargesController],
  providers: [ChargeRepository, IdempotencyRepository, CreateChargeService, GetChargeService],
  exports: [ChargeRepository],
})
export class ChargesModule {}
