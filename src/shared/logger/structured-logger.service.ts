import { Injectable, LoggerService } from '@nestjs/common';

export interface LogPayload {
  what: string;
  why: string;
  who?: string;
  how?: string;
  [key: string]: unknown;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private context = 'App';

  forContext(context: string): StructuredLoggerService {
    const scoped = new StructuredLoggerService();
    scoped.context = context;
    return scoped;
  }

  log(payload: LogPayload): void {
    process.stdout.write(JSON.stringify(this.build('info', payload)) + '\n');
  }

  warn(payload: LogPayload): void {
    process.stdout.write(JSON.stringify(this.build('warn', payload)) + '\n');
  }

  error(payload: LogPayload, trace?: string): void {
    process.stderr.write(
      JSON.stringify({ ...this.build('error', payload), trace: trace ?? null }) + '\n',
    );
  }

  debug(payload: LogPayload): void {
    process.stdout.write(JSON.stringify(this.build('debug', payload)) + '\n');
  }

  private build(level: string, payload: LogPayload): Record<string, unknown> {
    return {
      level,
      where: this.context,
      ...payload,
      correlation_id: null,
      when: new Date().toISOString(),
    };
  }
}
