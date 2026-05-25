import { vi } from 'vitest';
import type { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

export function createMockLogger() {
  return {
    forContext: vi.fn().mockReturnThis(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as StructuredLoggerService & {
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    forContext: ReturnType<typeof vi.fn>;
  };
}
