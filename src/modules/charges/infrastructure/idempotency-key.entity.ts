import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Charge } from '@/modules/charges/domain/charge.entity';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ type: 'varchar' })
  key!: string;

  @Column({ name: 'charge_id', type: 'varchar' })
  chargeId!: string;

  // Mesma coluna do chargeId acima — o relation object é usado só quando o
  // TypeORM precisa fazer join (ex.: `relations: ['charge']`); as escritas
  // continuam via chargeId, que é como o resto do código já opera.
  @ManyToOne(() => Charge)
  @JoinColumn({ name: 'charge_id' })
  charge?: Charge;

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
