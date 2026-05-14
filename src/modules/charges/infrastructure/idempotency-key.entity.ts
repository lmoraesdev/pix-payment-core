import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ type: 'varchar' })
  key!: string;

  @Column({ name: 'charge_id', type: 'varchar' })
  chargeId!: string;

  @Column({ name: 'request_hash', type: 'varchar' })
  requestHash!: string;

  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
