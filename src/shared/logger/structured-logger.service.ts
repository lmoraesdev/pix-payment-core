import { Injectable, LoggerService } from '@nestjs/common';

export interface Log5W1H {
  where: string;
  what: string;
  why: string;
  who?: string;
  how?: string;
  correlation_id?: string;
  [key: string]: unknown;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  log(payload: Log5W1H): void {
    process.stdout.write(
      JSON.stringify({ ...payload, level: 'info', when: new Date().toISOString() }) + '\n',
    );
  }

  error(payload: Log5W1H, trace?: string): void {
    process.stderr.write(
      JSON.stringify({ ...payload, level: 'error', when: new Date().toISOString(), trace }) + '\n',
    );
  }

  warn(payload: Log5W1H): void {
    process.stdout.write(
      JSON.stringify({ ...payload, level: 'warn', when: new Date().toISOString() }) + '\n',
    );
  }
}
