import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { databaseConfig } from './config/database.config';
import { ChargesModule } from './modules/charges/charges.module';
import { HealthModule } from './modules/health/health.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { LoggerModule } from './shared/logger/logger.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';
import { ValidationExceptionFilter } from './shared/filters/validation-exception.filter';
import { CorrelationIdMiddleware } from './shared/middleware/correlation-id.middleware';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: databaseConfig }),
    LoggerModule,
    HealthModule,
    ChargesModule,
    WebhooksModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // GlobalExceptionFilter registered first — NestJS applies filters in reverse order,
    // so DomainExceptionFilter runs first and GlobalExceptionFilter catches what's left.
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_FILTER, useClass: ValidationExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*splat');
  }
}
