import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { InternalModule } from './internal/internal.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HealthModule } from './health/health.module';
import { InboxModule } from './inbox/inbox.module';
import { MediaModule } from './media/media.module';
import { ContactsModule } from './contacts/contacts.module';
import { TeamModule } from './team/team.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 600,
      },
    ]),
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    InternalModule,
    ApiKeysModule,
    WebhooksModule,
    HealthModule,
    InboxModule,
    MediaModule,
    ContactsModule,
    TeamModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
