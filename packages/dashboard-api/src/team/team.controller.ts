import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsString } from 'class-validator';
import { Request } from 'express';
import { WorkspaceRole } from '@prisma/client';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { GRANTABLE_CAPABILITIES } from '../lib/capabilities';
import { TeamService } from './team.service';

class RoleDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}

class PermissionsDto {
  @IsArray()
  @IsString({ each: true })
  @IsIn(GRANTABLE_CAPABILITIES, { each: true })
  permissions: string[];
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

  @Get('my-role')
  myRole(@Req() req: AuthedRequest, @Param('workspaceId') ws: string) {
    return this.team.myRole(ws, req.user.userId);
  }

  @Get('members')
  members(@Req() req: AuthedRequest, @Param('workspaceId') ws: string) {
    return this.team.listMembers(ws, req.user.userId);
  }

  @Patch('members/:userId')
  changeRole(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('userId') userId: string, @Body() dto: RoleDto) {
    return this.team.changeRole(ws, req.user.userId, userId, dto.role as WorkspaceRole);
  }

  @Patch('members/:userId/permissions')
  setPermissions(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('userId') userId: string, @Body() dto: PermissionsDto) {
    return this.team.setMemberPermissions(ws, req.user.userId, userId, dto.permissions);
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
