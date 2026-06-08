import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Request } from 'express';
import { WorkspaceRole } from '@prisma/client';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { TeamService } from './team.service';

class RoleDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}

interface AuthedRequest extends Request {
  user: { userId: string };
}

@ApiTags('Team')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId')
@UseGuards(CombinedAuthGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  members(@Req() req: AuthedRequest, @Param('workspaceId') ws: string) {
    return this.team.listMembers(ws, req.user.userId);
  }

  @Patch('members/:userId')
  changeRole(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('userId') userId: string, @Body() dto: RoleDto) {
    return this.team.changeRole(ws, req.user.userId, userId, dto.role as WorkspaceRole);
  }

  @Delete('members/:userId')
  removeMember(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('userId') userId: string) {
    return this.team.removeMember(ws, req.user.userId, userId);
  }

  @Post('invites')
  createInvite(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Body() dto: RoleDto) {
    return this.team.createInvite(ws, req.user.userId, dto.role as WorkspaceRole);
  }

  @Get('invites')
  listInvites(@Req() req: AuthedRequest, @Param('workspaceId') ws: string) {
    return this.team.listInvites(ws, req.user.userId);
  }

  @Delete('invites/:inviteId')
  revokeInvite(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('inviteId') inviteId: string) {
    return this.team.revokeInvite(ws, req.user.userId, inviteId);
  }
}
