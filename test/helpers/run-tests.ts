import { it } from 'vitest';
import type { TestCase } from './types';

export function runTests<I, O>(
  testCases: Array<TestCase<I, O>>,
  callback: (name: string, testCase: { input: I; output: O }) => Promise<void> | void,
): void {
  for (const testCase of testCases) {
    const runner =
      testCase.testType === 'only' ? it.only
      : testCase.testType === 'skip' ? it.skip
      : it;
    runner(testCase.name, () =>
      callback(testCase.name, { input: testCase.input, output: testCase.output }),
    );
  }
}
