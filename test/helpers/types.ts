export interface StubConfig {
  resolves?: unknown;
  rejects?: unknown;
  returns?: unknown;
  error?: boolean;
}

export interface CallMatchConfig {
  called?: boolean;
  calledTimes?: number;
  calledWith?: unknown[];
  calledOnceWith?: unknown[];
  notCalled?: boolean;
}

export interface TestCase<I = unknown, O = unknown> {
  name: string;
  input: I;
  output: O;
  testType?: 'only' | 'skip';
}
