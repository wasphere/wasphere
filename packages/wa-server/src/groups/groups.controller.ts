import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
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

@ApiTags('Groups')
@Controller('sessions/:sessionId/groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all groups',
    description: 'Returns all WhatsApp groups the session account is currently a participant of.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 200, description: 'Array of group objects.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  getAllGroups(@Param('sessionId', ValidateSessionIdPipe) sid: string) {
    return this.groupsService.getAllGroupsParticipating(sid);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new group',
    description: 'Creates a WhatsApp group with the given name and an initial list of participant phone numbers. The session account becomes the group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Group created. Returns the group JID and metadata.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  createGroup(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: CreateGroupDto,
  ) {
    return this.groupsService.createGroup(sid, body.name, body.participants);
  }

  @Get(':groupId')
  @ApiOperation({
    summary: 'Get group info',
    description: 'Returns metadata for a specific group including name, description, participants, and admin list.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Group metadata object.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  getGroupInfo(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.getGroupInfo(sid, gid);
  }

  @Get(':groupId/picture')
  @ApiOperation({
    summary: 'Get group profile picture',
    description: 'Returns the URL of the group\'s current profile picture. Returns null if no picture is set or the session lacks permission to view it.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Profile picture URL or null.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  getGroupPicture(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.getGroupPicture(sid, gid);
  }

  @Put(':groupId/picture')
  @ApiOperation({
    summary: 'Update group profile picture',
    description: 'Downloads the image from the given URL and sets it as the group\'s profile picture. Requires the session account to be a group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Group picture updated.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  updateGroupPicture(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: UpdateGroupPictureDto,
  ) {
    return this.groupsService.updateGroupPicture(sid, gid, body.imageUrl);
  }

  @Put(':groupId/name')
  @ApiOperation({
    summary: 'Update group name',
    description: 'Changes the display name of the group. Requires the session account to be a group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Group name updated.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  updateGroupName(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: UpdateGroupNameDto,
  ) {
    return this.groupsService.updateGroupName(sid, gid, body.name);
  }

  @Put(':groupId/description')
  @ApiOperation({
    summary: 'Update group description',
    description: 'Changes the group\'s description text. Pass an empty string to clear the description. Requires the session account to be a group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Group description updated.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  updateGroupDescription(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: UpdateGroupDescriptionDto,
  ) {
    return this.groupsService.updateGroupDescription(sid, gid, body.description);
  }

  @Post('join')
  @ApiOperation({
    summary: 'Join a group via invite link',
    description: 'Joins a WhatsApp group using an invite code extracted from an invite link (e.g., the code from https://chat.whatsapp.com/<code>).',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Joined the group successfully. Returns group metadata.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found or invite link invalid.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  joinByInviteLink(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: JoinGroupDto,
  ) {
    return this.groupsService.joinByInviteLink(sid, body.inviteCode);
  }

  @Post(':groupId/participants/add')
  @ApiOperation({
    summary: 'Add participants to a group',
    description: 'Adds one or more WhatsApp numbers to the group. Requires the session account to be a group admin. Returns per-participant status indicating success or failure.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Per-participant add result.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  addParticipants(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: ParticipantsDto,
  ) {
    return this.groupsService.addParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/remove')
  @ApiOperation({
    summary: 'Remove participants from a group',
    description: '⚠️ DESTRUCTIVE: Removes one or more participants from the group. Removed participants lose access to the group\'s message history. Requires the session account to be a group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Per-participant remove result.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  removeParticipants(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: ParticipantsDto,
  ) {
    return this.groupsService.removeParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/promote')
  @ApiOperation({
    summary: 'Promote participants to admin',
    description: 'Grants admin privileges to one or more group participants. Requires the session account to be a group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Participants promoted to admin.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  promoteParticipants(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: ParticipantsDto,
  ) {
    return this.groupsService.promoteParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/participants/demote')
  @ApiOperation({
    summary: 'Demote admin participants',
    description: 'Revokes admin privileges from one or more group admins, reverting them to regular participants. Requires the session account to be a group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Admin privileges revoked.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  demoteParticipants(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: ParticipantsDto,
  ) {
    return this.groupsService.demoteParticipants(sid, gid, body.participants);
  }

  @Post(':groupId/leave')
  @ApiOperation({
    summary: 'Leave a group',
    description: '⚠️ DESTRUCTIVE: The session account leaves the specified WhatsApp group. If the account is the sole admin, WhatsApp will randomly promote another participant before the leave occurs.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Left the group.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  leaveGroup(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.leaveGroup(sid, gid);
  }

  @Get(':groupId/invite-link')
  @ApiOperation({
    summary: 'Get group invite link',
    description: 'Retrieves the current WhatsApp invite link for the group. Requires the session account to be a group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Invite link string.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  getInviteLink(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.getInviteLink(sid, gid);
  }

  @Post(':groupId/invite-link/revoke')
  @ApiOperation({
    summary: 'Revoke group invite link',
    description: '⚠️ DESTRUCTIVE: Invalidates the current group invite link and generates a new one. Anyone with the old link can no longer join. Requires the session account to be a group admin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'New invite link generated and returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  revokeInviteLink(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
  ) {
    return this.groupsService.revokeInviteLink(sid, gid);
  }

  @Put(':groupId/settings')
  @ApiOperation({
    summary: 'Update group settings',
    description: 'Changes group-level settings. Use "announcement" to restrict messaging to admins only, "not_announcement" to allow all participants to send, "locked" to prevent non-admins from editing group info, or "unlocked" to allow it.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'groupId', description: 'WhatsApp group JID', example: '1234567890-1234567890@g.us' })
  @ApiResponse({ status: 200, description: 'Group settings updated.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or group not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  updateSettings(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('groupId', ValidateGroupIdPipe) gid: string,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.groupsService.updateGroupSettings(sid, gid, body.setting);
  }
}
