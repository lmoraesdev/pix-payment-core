export async function getError<E = Error>(fn: () => Promise<unknown>): Promise<E> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    return error as E;
  }
}
