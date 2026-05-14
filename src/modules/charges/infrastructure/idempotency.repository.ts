import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyKey } from './idempotency-key.entity';

@Injectable()
export class IdempotencyRepository {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async findByKey(key: string): Promise<IdempotencyKey | null> {
    return this.repo.findOneBy({ key });
  }

  async save(record: IdempotencyKey): Promise<IdempotencyKey> {
    return this.repo.save(record);
  }
}
