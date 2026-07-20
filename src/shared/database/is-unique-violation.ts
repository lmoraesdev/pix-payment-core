import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  return (err as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION;
}
