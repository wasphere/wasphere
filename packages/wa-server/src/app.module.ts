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
    consumer
      .apply(AuthMiddleware)
      .exclude('api/health') // health check is public
      .forRoutes('*');
  }
}
