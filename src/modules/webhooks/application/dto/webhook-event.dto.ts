import { IsDateString, IsIn, IsString } from 'class-validator';

export class WebhookEventDto {
  @IsString()
  event_id!: string;

  @IsString()
  @IsIn(['payment.confirmed', 'payment.expired'])
  type!: string;

  @IsString()
  charge_id!: string;

  @IsDateString()
  occurred_at!: string;
}
