import { vi } from 'vitest';
import type { StubConfig } from './types';

type MockFn = ReturnType<typeof vi.fn>;

export function setupMock(mock: MockFn, config: StubConfig): MockFn {
  if (config.error) {
    if ('resolves' in config) {
      mock.mockRejectedValue(config.resolves);
    } else if ('returns' in config) {
      mock.mockImplementation(() => {
        throw config.returns;
      });
    }
  } else {
    if ('resolves' in config) {
      mock.mockResolvedValue(config.resolves);
    } else if ('returns' in config) {
      mock.mockReturnValue(config.returns);
    } else if ('rejects' in config) {
      mock.mockRejectedValue(config.rejects);
    }
  }
  return mock;
}

export function setupStubs<T extends Record<string, MockFn>>(
  target: T,
  configs: Partial<Record<keyof T, StubConfig>>,
): void {
  for (const [method, config] of Object.entries(configs)) {
    if (config && method in target) {
      setupMock(target[method as keyof T], config as StubConfig);
    }
  }
}
