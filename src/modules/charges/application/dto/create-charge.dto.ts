import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateChargeDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsString()
  @Matches(/^\d{11}$/, { message: 'payer_document must be an 11-digit CPF' })
  payer_document!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
