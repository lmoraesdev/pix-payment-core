import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { databaseConfig } from './config/database.config';
import { ChargesModule } from './modules/charges/charges.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { LoggerModule } from './shared/logger/logger.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';
import { CorrelationIdMiddleware } from './shared/middleware/correlation-id.middleware';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: databaseConfig }),
    LoggerModule,
    ChargesModule,
    WebhooksModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*splat');
  }
}
