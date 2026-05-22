import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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
    const rawSwaggerPath = (process.env.SWAGGER_PATH ?? '/api/docs').replace(/\/$/, '');
    const swaggerPath = rawSwaggerPath.replace(/^\/api\//, '');

    // When Basic Auth is configured, exclude docs paths so Basic Auth middleware
    // can respond before AuthMiddleware intercepts the request.
    const docsPaths = basicUser && basicPass
      ? [swaggerPath, `${swaggerPath}-json`]
      : [];

    consumer
      .apply(AuthMiddleware)
      .exclude('health', ...docsPaths) // health check is public; docs excluded when Basic Auth is active
      .forRoutes('*');
  }
}
