import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

type ZodIssue = { path: (string | number)[]; message: string };

@Catch(ZodValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger: StructuredLoggerService;

  constructor(logger: StructuredLoggerService) {
    this.logger = logger.forContext('ValidationExceptionFilter');
  }

  catch(exception: ZodValidationException, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();

    const zodError = exception.getZodError() as { issues: ZodIssue[] };
    const message = zodError.issues
      .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');

    this.logger.warn({
      what: 'validation_error',
      why: ErrorCode.VALIDATION_ERROR,
      how: `${req.method} ${req.url}`,
      message,
    });

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({ statusCode: HttpStatus.BAD_REQUEST, code: ErrorCode.VALIDATION_ERROR, message });
  }
}
