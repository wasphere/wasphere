import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { InboxController } from './inbox.controller';
import { InboxSseController } from './inbox-sse.controller';
import { InboxService } from './inbox.service';
import { InboxIngestService } from './inbox-ingest.service';
import { InboxEventsService } from './inbox-events.service';
import { InboxSseService } from './inbox-sse.service';

// PrismaModule imported explicitly (its @Global export wasn't resolving into this
// module's injector inside the ApiKeys<->Auth resolution chain).
// ApiKeysModule -> CombinedAuthGuard depends on ApiKeysService.
// JwtModule -> InboxSseService verifies the SSE token (same secret as AuthModule).
@Module({
  imports: [
    PrismaModule,
    WorkspacesModule,
    ApiKeysModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [InboxController, InboxSseController],
  providers: [InboxService, InboxIngestService, InboxEventsService, InboxSseService],
  // InboxIngestService -> consumed by InternalModule (ingestion hook)
  // InboxEventsService -> consumed by the SSE layer
  exports: [InboxIngestService, InboxEventsService],
})
export class InboxModule {}
