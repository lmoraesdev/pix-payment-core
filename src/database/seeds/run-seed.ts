import 'reflect-metadata';
import dataSource from '@/config/data-source';
import { Charge } from '@/modules/charges/domain/charge.entity';
import { ChargeStatus } from '@/modules/charges/domain/charge-status.enum';

// Cobranças de exemplo cobrindo os estados que a state machine permite atingir
// via fluxo normal (CREATED é transitório e nunca chega a ser persistido).
const seedCharges: Charge[] = [
  Object.assign(new Charge(), {
    id: 'ch_seed_awaiting_payment',
    status: ChargeStatus.AWAITING_PAYMENT,
    amount: 5_000,
    currency: 'BRL',
    payerDocument: '12345678900',
    description: 'Pedido #1001 — aguardando pagamento',
    qrCode: '00020126...seed-awaiting',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  }),
  Object.assign(new Charge(), {
    id: 'ch_seed_paid',
    status: ChargeStatus.PAID,
    amount: 12_990,
    currency: 'BRL',
    payerDocument: '98765432100',
    description: 'Pedido #1002 — pago',
    qrCode: '00020126...seed-paid',
    expiresAt: new Date(Date.now() - 10 * 60 * 1000),
  }),
  Object.assign(new Charge(), {
    id: 'ch_seed_expired',
    status: ChargeStatus.EXPIRED,
    amount: 2_500,
    currency: 'BRL',
    payerDocument: '11122233344',
    description: 'Pedido #1003 — expirado sem pagamento',
    qrCode: '00020126...seed-expired',
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  }),
];

async function runSeed(): Promise<void> {
  await dataSource.initialize();

  const chargeRepository = dataSource.getRepository(Charge);
  // save() faz upsert pela primary key — seguro rodar o seed mais de uma vez.
  await chargeRepository.save(seedCharges);

  for (const charge of seedCharges) {
    console.log(`seeded charge ${charge.id} (${charge.status})`);
  }

  await dataSource.destroy();
}

runSeed().catch((error: unknown) => {
  console.error('seed failed:', error);
  process.exitCode = 1;
});
