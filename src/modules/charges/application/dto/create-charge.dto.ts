import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateChargeSchema = z.object({
  amount: z.number().int().min(1),
  currency: z.string().length(3),
  payer_document: z.string().regex(/^\d{11}$/, 'payer_document must be an 11-digit CPF'),
  description: z.string().optional(),
});

export class CreateChargeDto extends createZodDto(CreateChargeSchema) {}
