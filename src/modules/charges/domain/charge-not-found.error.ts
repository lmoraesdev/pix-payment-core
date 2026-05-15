export class ChargeNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`Charge not found: "${id}"`);
    this.name = 'ChargeNotFoundError';
  }
}
