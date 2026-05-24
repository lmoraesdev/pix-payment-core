import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '@/shared/errors/domain.error';
import { ErrorCode } from '@/shared/errors/error-code.enum';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

@Catch(Error)
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: StructuredLoggerService;

  constructor(logger: StructuredLoggerService) {
    this.logger = logger.forContext('GlobalExceptionFilter');
  }

  catch(exception: Error, host: ArgumentsHost): void {
    if (exception instanceof DomainError) return;

    const req = host.switchToHttp().getRequest<Request>();

    this.logger.error(
      {
        what: 'unhandled_error',
        why: 'unexpected_exception',
        how: `${req.method} ${req.url}`,
        error_class: exception.constructor.name,
        message: exception.message,
      },
      exception.stack,
    );

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      });
  }
}
