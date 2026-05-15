import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationStore {
  correlationId: string;
}

export const correlationIdStorage = new AsyncLocalStorage<CorrelationStore>();
