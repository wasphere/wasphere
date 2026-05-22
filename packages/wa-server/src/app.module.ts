import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { SessionsModule } from './sessions/sessions.module';
import { MessagesModule } from './messages/messages.module';
import { GroupsModule } from './groups/groups.module';
import { ContactsModule } from './contacts/contacts.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HealthModule } from './health/health.module';
import { AuthMiddleware } from './auth/auth.middleware';

@Module({
  imports: [
    WhatsAppModule,
    SessionsModule,
    MessagesModule,
    GroupsModule,
    ContactsModule,
    WebhooksModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const basicUser = process.env.DOCS_BASIC_AUTH_USER;
    const basicPass = process.env.DOCS_BASIC_AUTH_PASS;
    // swaggerPath is the full path as Express sees it (matches main.ts calculation)
    const swaggerPath = (process.env.SWAGGER_PATH ?? 'api/docs').replace(/^\/+|\/+$/g, '');

    // When Basic Auth is configured, exclude docs paths so the Express-level Basic Auth
    // middleware can respond before AuthMiddleware intercepts.
    // Paths must match the full URL (Swagger routes are Express-level, not NestJS routes).
    const docsPaths = basicUser && basicPass
      ? [`/${swaggerPath}`, `/${swaggerPath}-json`]
      : [];

    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        ...docsPaths,
      )
      .forRoutes('*');
  }
}
