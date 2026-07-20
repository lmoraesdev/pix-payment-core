import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { IdempotencyKey } from './idempotency-key.entity';

@Injectable()
export class IdempotencyRepository {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async findByKey(key: string, manager?: EntityManager): Promise<IdempotencyKey | null> {
    const repo = manager ? manager.getRepository(IdempotencyKey) : this.repo;
    return repo.findOneBy({ key });
  }

  async save(record: IdempotencyKey, manager?: EntityManager): Promise<IdempotencyKey> {
    const repo = manager ? manager.getRepository(IdempotencyKey) : this.repo;
    return repo.save(record);
  }
}
