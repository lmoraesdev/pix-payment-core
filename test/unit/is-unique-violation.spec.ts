import { describe, expect, it } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { isUniqueViolation } from '@/shared/database/is-unique-violation';

describe('isUniqueViolation', () => {
  it('retorna true para QueryFailedError do Postgres com code 23505 (unique_violation)', () => {
    const err = new QueryFailedError('INSERT ...', [], new Error('duplicate key'));
    (err as unknown as { code: string }).code = '23505';

    expect(isUniqueViolation(err)).toBe(true);
  });

  it('retorna false para QueryFailedError com outro code', () => {
    const err = new QueryFailedError('INSERT ...', [], new Error('not null violation'));
    (err as unknown as { code: string }).code = '23502';

    expect(isUniqueViolation(err)).toBe(false);
  });

  it('retorna false para erros que não são QueryFailedError', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });
});
