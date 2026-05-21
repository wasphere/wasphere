import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { EncryptionService } from './encryption.service';
import { ProxyService } from './proxy.service';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, EncryptionService, ProxyService],
})
export class WorkspacesModule {}
