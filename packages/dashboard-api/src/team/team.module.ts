import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { PublicInvitesController } from './public-invites.controller';
import { TeamService } from './team.service';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule], // CombinedAuthGuard needs ApiKeysService
  controllers: [TeamController, PublicInvitesController],
  providers: [TeamService],
})
export class TeamModule {}
