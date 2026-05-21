import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { ValidateSessionIdPipe } from '../common/validate-session-id.pipe';
import { ValidateGroupIdPipe } from '../common/pattern.pipe';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupPictureDto } from './dto/update-group-picture.dto';
import { UpdateGroupNameDto } from './dto/update-group-name.dto';
import { UpdateGroupDescriptionDto } from './dto/update-group-description.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { ParticipantsDto } from './dto/participants.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('sessions/:sessionId/groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Get()
  getAllGroups(@Param('sessionId', ValidateSessionIdPipe) sid: string) {
    return this.groupsService.getAllGroupsParticipating(sid);
  }

  @Post()
  createGroup(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: CreateGroupDto,
  ) {
    return this.groupsService.createGroup(sid, body.name, body.participants);
  }

  @Get(':groupId')
  getGroupInfo(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.getGroupInfo(sid, gid);
  }

  @Get(':groupId/picture')
  getGroupPicture(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.getGroupPicture(sid, gid);
  }

  @Put(':groupId/picture')
  updateGroupPicture(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: UpdateGroupPictureDto,
  ) {
    return this.groupsService.updateGroupPicture(sid, gid, body.imageUrl);
  }

  @Put(':groupId/name')
  updateGroupName(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: UpdateGroupNameDto,
  ) {
    return this.groupsService.updateGroupName(sid, gid, body.name);
  }

  @Put(':groupId/description')
  updateGroupDescription(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: UpdateGroupDescriptionDto,
  ) {
    return this.groupsService.updateGroupDescription(sid, gid, body.description);
  }

  @Post('join')
  joinByInviteLink(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: JoinGroupDto,
  ) {
    return this.groupsService.joinByInviteLink(sid, body.inviteCode);
  }

  @Post(':groupId/participants/add')
  addParticipants(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: ParticipantsDto,
  ) {
    return this.groupsService.addParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/remove')
  removeParticipants(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: ParticipantsDto,
  ) {
    return this.groupsService.removeParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/promote')
  promoteParticipants(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: ParticipantsDto,
  ) {
    return this.groupsService.promoteParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/demote')
  demoteParticipants(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: ParticipantsDto,
  ) {
    return this.groupsService.demoteParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/leave')
  leaveGroup(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.leaveGroup(sid, gid);
  }

  @Get(':groupId/invite-link')
  getInviteLink(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.getInviteLink(sid, gid);
  }

  @Post(':groupId/invite-link/revoke')
  revokeInviteLink(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.revokeInviteLink(sid, gid);
  }

  @Put(':groupId/settings')
  updateSettings(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.groupsService.updateGroupSettings(sid, gid, body.setting);
  }
}
