import { ChargeStatus } from '../../domain/charge-status.enum';

export class ChargeResponseDto {
  id!: string;
  status!: ChargeStatus;
  amount!: number;
  currency!: string;
  qr_code!: string | null;
  expires_at!: Date | null;
  created_at!: Date;
}
