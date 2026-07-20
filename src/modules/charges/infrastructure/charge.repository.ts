import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Charge } from '@/modules/charges/domain/charge.entity';

@Injectable()
export class ChargeRepository {
  constructor(
    @InjectRepository(Charge)
    private readonly repo: Repository<Charge>,
  ) {}

  async findById(id: string): Promise<Charge | null> {
    return this.repo.findOneBy({ id });
  }

  /**
   * Lê a charge com pessimistic_write lock (SELECT ... FOR UPDATE).
   * Deve ser chamado dentro de uma transação — sem isso o lock é liberado
   * imediatamente e não protege contra leituras concorrentes.
   */
  async findByIdForUpdate(id: string, manager: EntityManager): Promise<Charge | null> {
    return manager.getRepository(Charge).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  async save(charge: Charge, manager?: EntityManager): Promise<Charge> {
    const repo = manager ? manager.getRepository(Charge) : this.repo;
    return repo.save(charge);
  }
}
