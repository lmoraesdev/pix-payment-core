import { expect } from 'vitest';
import type { CallMatchConfig } from './types';

type MockFn = ReturnType<typeof import('vitest').vi.fn>;

export function assertMockCalls(methodName: string, mock: MockFn, config: CallMatchConfig): void {
  if (config.notCalled) {
    expect(mock, `${methodName} should not have been called`).not.toHaveBeenCalled();
    return;
  }

  if (config.called !== undefined) {
    if (config.called) {
      expect(mock, `${methodName} should have been called`).toHaveBeenCalled();
    } else {
      expect(mock, `${methodName} should not have been called`).not.toHaveBeenCalled();
    }
  }

  if (config.calledTimes !== undefined) {
    expect(mock, `${methodName} should have been called ${config.calledTimes} times`).toHaveBeenCalledTimes(
      config.calledTimes,
    );
  }

  if (config.calledWith) {
    expect(mock, `${methodName} calledWith mismatch`).toHaveBeenCalledWith(...config.calledWith);
  }

  if (config.calledOnceWith) {
    expect(mock, `${methodName} should have been called once`).toHaveBeenCalledOnce();
    expect(mock, `${methodName} calledOnceWith mismatch`).toHaveBeenCalledWith(
      ...config.calledOnceWith,
    );
  }
}

export function assertStubs<T extends Record<string, MockFn>>(
  depName: string,
  target: T,
  configs: Partial<Record<keyof T, CallMatchConfig>>,
): void {
  for (const [method, config] of Object.entries(configs)) {
    if (config && method in target) {
      assertMockCalls(`${depName}.${method}`, target[method as keyof T], config as CallMatchConfig);
    }
  }
}
