import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { correlationIdStorage } from '@/shared/logger/correlation-id.storage';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

describe('StructuredLoggerService', () => {
  let logger: StructuredLoggerService;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new StructuredLoggerService().forContext('TestService');
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  function lastLine(): Record<string, unknown> {
    return JSON.parse((stdoutSpy.mock.calls[0][0] as string).trimEnd()) as Record<string, unknown>;
  }

  describe('formato 5W1H', () => {
    it('inclui where, what, why, when, level e correlation_id', () => {
      logger.log({ what: 'test_event', why: 'testing' });

      const out = lastLine();
      expect(out.where).toBe('TestService');
      expect(out.what).toBe('test_event');
      expect(out.why).toBe('testing');
      expect(out.when).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(out.level).toBe('info');
      expect('correlation_id' in out).toBe(true);
    });

    it('inclui campos extras (charge_id, amount, etc.)', () => {
      logger.log({ what: 'charge_created', why: 'user_request', charge_id: 'ch_123', amount: 10000 });

      const out = lastLine();
      expect(out.charge_id).toBe('ch_123');
      expect(out.amount).toBe(10000);
    });

    it('warn usa level "warn"', () => {
      logger.warn({ what: 'conflict', why: 'key_reused' });

      const out = lastLine();
      expect(out.level).toBe('warn');
    });
  });

  describe('correlation_id', () => {
    it('lê do storage quando presente', () => {
      correlationIdStorage.run({ correlationId: 'req_abc123' }, () => {
        logger.log({ what: 'test_event', why: 'testing' });
      });

      const out = lastLine();
      expect(out.correlation_id).toBe('req_abc123');
    });

    it('usa null quando storage está vazio', () => {
      logger.log({ what: 'test_event', why: 'testing' });

      const out = lastLine();
      expect(out.correlation_id).toBeNull();
    });
  });

  describe('forContext', () => {
    it('retorna instância com where diferente', () => {
      const scoped = new StructuredLoggerService().forContext('AnotherService');
      scoped.log({ what: 'test_event', why: 'testing' });

      const out = lastLine();
      expect(out.where).toBe('AnotherService');
    });
  });
});
