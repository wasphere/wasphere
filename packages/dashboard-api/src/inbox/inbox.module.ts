import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { InboxIngestService } from './inbox-ingest.service';
import { InboxEventsService } from './inbox-events.service';

// PrismaModule imported explicitly (its @Global export wasn't resolving into this
// module's injector inside the ApiKeys<->Auth resolution chain).
// ApiKeysModule -> CombinedAuthGuard depends on ApiKeysService.
@Module({
  imports: [PrismaModule, WorkspacesModule, ApiKeysModule],
  controllers: [InboxController],
  providers: [InboxService, InboxIngestService, InboxEventsService],
  // InboxIngestService -> consumed by InternalModule (ingestion hook)
  // InboxEventsService -> consumed by the SSE layer in Commit 3
  exports: [InboxIngestService, InboxEventsService],
})
export class InboxModule {}
