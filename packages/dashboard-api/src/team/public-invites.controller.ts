import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TeamService } from './team.service';

// Public (no auth): the invite-accept page reads this to show workspace + role
// before the user signs up / logs in.
@ApiTags('Team')
@Controller('invites')
export class PublicInvitesController {
  constructor(private readonly team: TeamService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.team.previewInvite(token);
  }
}
