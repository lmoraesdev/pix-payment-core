import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { ValidationExceptionFilter } from '@/shared/filters/validation-exception.filter';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import { createMockLogger } from '@test/fakes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ZodIssuePath = (string | number)[];

function makeZodException(issues: Array<{ path: ZodIssuePath; message: string }>) {
  return { getZodError: () => ({ issues }) } as unknown as ZodValidationException;
}

function makeHost(jsonSpy = vi.fn()) {
  const response = { status: vi.fn().mockReturnValue({ json: jsonSpy }) };
  const request = { method: 'POST', url: '/charges' };
  return {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    response,
    jsonSpy,
  };
}

// ─── Test Table ───────────────────────────────────────────────────────────────

interface ValidationRow {
  scenario: string;
  issues: Array<{ path: ZodIssuePath; message: string }>;
  expectedMessage: string;
}

const validationRows: ValidationRow[] = [
  {
    scenario: 'erro em campo simples',
    issues: [{ path: ['amount'], message: 'must be positive' }],
    expectedMessage: 'amount: must be positive',
  },
  {
    scenario: 'erro em campo aninhado',
    issues: [{ path: ['metadata', 'source'], message: 'required' }],
    expectedMessage: 'metadata.source: required',
  },
  {
    scenario: 'erro no nível raiz (sem path)',
    issues: [{ path: [], message: 'corpo inválido' }],
    expectedMessage: 'corpo inválido',
  },
  {
    scenario: 'múltiplos erros concatenados por ponto-e-vírgula',
    issues: [
      { path: ['amount'], message: 'must be positive' },
      { path: ['currency'], message: 'invalid currency' },
    ],
    expectedMessage: 'amount: must be positive; currency: invalid currency',
  },
];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ValidationExceptionFilter', () => {
  let filter: ValidationExceptionFilter;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    filter = new ValidationExceptionFilter(mockLogger);
  });

  it.each(validationRows)(
    '$scenario → 400 com código VE01 e mensagem formatada',
    ({ issues, expectedMessage }) => {
      const jsonSpy = vi.fn();
      const host = makeHost(jsonSpy);
      const exception = makeZodException(issues);

      filter.catch(exception, host as never);

      expect(host.response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

      expect(jsonSpy).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        code: ErrorCode.VALIDATION_ERROR,
        message: expectedMessage,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          what: 'validation_error',
          why: ErrorCode.VALIDATION_ERROR,
          how: 'POST /charges',
          message: expectedMessage,
        }),
      );
    },
  );
});
