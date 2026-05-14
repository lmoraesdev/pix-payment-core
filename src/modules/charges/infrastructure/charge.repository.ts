import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Charge } from '../domain/charge.entity';

@Injectable()
export class ChargeRepository {
  constructor(
    @InjectRepository(Charge)
    private readonly repo: Repository<Charge>,
  ) {}

  async findById(id: string): Promise<Charge | null> {
    return this.repo.findOneBy({ id });
  }

  async save(charge: Charge): Promise<Charge> {
    return this.repo.save(charge);
  }
}
