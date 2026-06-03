import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { EncryptionService } from './encryption.service';
import { ProxyService } from './proxy.service';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, EncryptionService, ProxyService],
  // WorkspacesService -> consumed by InboxModule (reply-send needs getDecryptedToken)
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
