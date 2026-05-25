import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateChargeSchema = z.object({
  amount: z.number().int().safe().min(1).max(2147483647),
  currency: z.enum(['BRL']),
  payer_document: z.string().regex(/^\d{11}$/, 'payer_document must be an 11-digit CPF'),
  description: z.string().optional(),
});

export class CreateChargeDto extends createZodDto(CreateChargeSchema) {}
