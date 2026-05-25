import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { StructuredLoggerService } from '@/shared/logger/structured-logger.service';

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger.forContext('HealthController');
  }

  @Get('health')
  @ApiOperation({ summary: 'Liveness + readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is up and database is reachable' })
  @ApiResponse({ status: 503, description: 'Database is unreachable' })
  async check(@Res() res: Response): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1');
      res.status(HttpStatus.OK).json({ status: 'ok', database: 'connected' });
    } catch (err) {
      this.logger.warn({
        what: 'health_check_failed',
        why: 'database_unreachable',
        how: 'GET /health',
        message: (err as Error).message,
      });
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'degraded', database: 'unreachable' });
    }
  }
}
