import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { SessionsModule } from './sessions/sessions.module';
import { MessagesModule } from './messages/messages.module';
import { GroupsModule } from './groups/groups.module';
import { ContactsModule } from './contacts/contacts.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HealthModule } from './health/health.module';
import { AuthMiddleware } from './auth/auth.middleware';
import { AuditModule } from './audit/audit.module';
import { AuditMiddleware } from './audit/audit.middleware';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { AllowlistModule } from './allowlist/allowlist.module';
import { AllowlistMiddleware } from './allowlist/allowlist.middleware';

@Module({
  imports: [
    WhatsAppModule,
    SessionsModule,
    MessagesModule,
    GroupsModule,
    ContactsModule,
    WebhooksModule,
    HealthModule,
    AuditModule,
    RateLimitModule,
    AllowlistModule,
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

    // AuditMiddleware must be registered FIRST so res.on('finish') is attached before
    // AuthMiddleware can short-circuit the request (e.g. 401). Without this ordering,
    // rejected requests are invisible to audit.
    consumer
      .apply(AuditMiddleware)
      .forRoutes('*');

    consumer
      .apply(AllowlistMiddleware)
      .forRoutes('*');

    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        // Meta sends no API token — the webhook is authenticated by its
        // verify-token handshake (GET) and X-Hub-Signature-256 HMAC (POST).
        { path: 'meta/webhook/:sessionId', method: RequestMethod.GET },
        { path: 'meta/webhook/:sessionId', method: RequestMethod.POST },
        ...docsPaths,
      )
      .forRoutes('*');
  }
}
