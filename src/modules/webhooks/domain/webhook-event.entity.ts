import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryColumn({ name: 'event_id', type: 'varchar' })
  eventId!: string;

  @Column({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
