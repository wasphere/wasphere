import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { GroupsService } from './groups.service';

class JoinGroupDto {
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
}

@Controller('sessions/:sessionId/groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Get()
  getAllGroups(@Param('sessionId') sid: string) {
    return this.groupsService.getAllGroupsParticipating(sid);
  }

  @Post()
  createGroup(
    @Param('sessionId') sid: string,
    @Body() body: { name: string; participants: string[] },
  ) {
    return this.groupsService.createGroup(sid, body.name, body.participants);
  }

  @Get(':groupId')
  getGroupInfo(@Param('sessionId') sid: string, @Param('groupId') gid: string) {
    return this.groupsService.getGroupInfo(sid, gid);
  }

  @Get(':groupId/picture')
  getGroupPicture(@Param('sessionId') sid: string, @Param('groupId') gid: string) {
    return this.groupsService.getGroupPicture(sid, gid);
  }

  @Put(':groupId/picture')
  updateGroupPicture(
    @Param('sessionId') sid: string,
    @Param('groupId') gid: string,
    @Body() body: { imageUrl: string },
  ) {
    return this.groupsService.updateGroupPicture(sid, gid, body.imageUrl);
  }

  @Put(':groupId/name')
  updateGroupName(
    @Param('sessionId') sid: string,
    @Param('groupId') gid: string,
    @Body() body: { name: string },
  ) {
    return this.groupsService.updateGroupName(sid, gid, body.name);
  }

  @Put(':groupId/description')
  updateGroupDescription(
    @Param('sessionId') sid: string,
    @Param('groupId') gid: string,
    @Body() body: { description: string },
  ) {
    return this.groupsService.updateGroupDescription(sid, gid, body.description);
  }

  @Post('join')
  joinByInviteLink(
    @Param('sessionId') sid: string,
    @Body() body: JoinGroupDto,
  ) {
    return this.groupsService.joinByInviteLink(sid, body.inviteCode);
  }

  @Post(':groupId/participants/add')
  addParticipants(
    @Param('sessionId') sid: string,
    @Param('groupId') gid: string,
    @Body() body: { participants: string[] },
  ) {
    return this.groupsService.addParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/remove')
  removeParticipants(
    @Param('sessionId') sid: string,
    @Param('groupId') gid: string,
    @Body() body: { participants: string[] },
  ) {
    return this.groupsService.removeParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/promote')
  promoteParticipants(
    @Param('sessionId') sid: string,
    @Param('groupId') gid: string,
    @Body() body: { participants: string[] },
  ) {
    return this.groupsService.promoteParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/demote')
  demoteParticipants(
    @Param('sessionId') sid: string,
    @Param('groupId') gid: string,
    @Body() body: { participants: string[] },
  ) {
    return this.groupsService.demoteParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/leave')
  leaveGroup(@Param('sessionId') sid: string, @Param('groupId') gid: string) {
    return this.groupsService.leaveGroup(sid, gid);
  }

  @Get(':groupId/invite-link')
  getInviteLink(@Param('sessionId') sid: string, @Param('groupId') gid: string) {
    return this.groupsService.getInviteLink(sid, gid);
  }

  @Post(':groupId/invite-link/revoke')
  revokeInviteLink(@Param('sessionId') sid: string, @Param('groupId') gid: string) {
    return this.groupsService.revokeInviteLink(sid, gid);
  }

  @Put(':groupId/settings')
  updateSettings(
    @Param('sessionId') sid: string,
    @Param('groupId') gid: string,
    @Body() body: { setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked' },
  ) {
    return this.groupsService.updateGroupSettings(sid, gid, body.setting);
  }
}
