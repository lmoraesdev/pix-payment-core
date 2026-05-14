import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { ChargesModule } from './modules/charges/charges.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { CorrelationIdMiddleware } from './shared/middleware/correlation-id.middleware';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: databaseConfig }),
    ChargesModule,
    WebhooksModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*splat');
  }
}
