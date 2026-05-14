import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChargeStatus } from './charge-status.enum';

@Entity('charges')
export class Charge {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'enum', enum: ChargeStatus, enumName: 'charge_status_enum' })
  status!: ChargeStatus;

  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'payer_document', type: 'varchar' })
  payerDocument!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ name: 'qr_code', type: 'varchar', nullable: true })
  qrCode!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  transitionTo(_nextStatus: ChargeStatus): void {
    // TODO: implement next session — delegates to ChargeStateMachine.assertTransition
    throw new Error('Not implemented');
  }
}
