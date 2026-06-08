import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { CAPABILITIES } from '../lib/capabilities';
import { TeamService } from './team.service';

// `role` is either the literal 'ADMIN' tier or a custom-role id (uuid).
class RoleRefDto {
  @IsString()
  @MinLength(1)
  role: string;
}

class CreateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @IsArray()
  @IsIn(CAPABILITIES, { each: true })
  capabilities: string[];
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsIn(CAPABILITIES, { each: true })
  capabilities?: string[];
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
  assignRole(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('userId') userId: string, @Body() dto: RoleRefDto) {
    return this.team.assignRole(ws, req.user.userId, userId, dto.role);
  }

  @Delete('members/:userId')
  removeMember(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('userId') userId: string) {
    return this.team.removeMember(ws, req.user.userId, userId);
  }

  // ── Custom roles ─────────────────────────────────────────────────────────

  @Get('roles')
  listRoles(@Req() req: AuthedRequest, @Param('workspaceId') ws: string) {
    return this.team.listRoles(ws, req.user.userId);
  }

  @Post('roles')
  createRole(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Body() dto: CreateRoleDto) {
    return this.team.createRole(ws, req.user.userId, dto.name, dto.capabilities);
  }

  @Patch('roles/:roleId')
  updateRole(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('roleId') roleId: string, @Body() dto: UpdateRoleDto) {
    return this.team.updateRole(ws, req.user.userId, roleId, dto.name, dto.capabilities);
  }

  @Delete('roles/:roleId')
  deleteRole(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Param('roleId') roleId: string) {
    return this.team.deleteRole(ws, req.user.userId, roleId);
  }

  // ── Invites ──────────────────────────────────────────────────────────────

  @Post('invites')
  createInvite(@Req() req: AuthedRequest, @Param('workspaceId') ws: string, @Body() dto: RoleRefDto) {
    return this.team.createInvite(ws, req.user.userId, dto.role);
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
