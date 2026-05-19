import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';

function toGroupJid(id: string): string {
  if (id.includes('@g.us')) return id;
  return `${id}@g.us`;
}

function toJid(number: string): string {
  if (number.includes('@')) return number;
  const clean = number.replace(/[^0-9]/g, '');
  return `${clean}@s.whatsapp.net`;
}

@Injectable()
export class GroupsService {
  constructor(private sessionsService: SessionsService) {}

  async createGroup(sessionId: string, name: string, participants: string[]) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jids = participants.map(toJid);
    const result = await sock.groupCreate(name, jids);
    return { groupId: result.id, name, participants: jids };
  }

  async getGroupInfo(sessionId: string, groupId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const metadata = await sock.groupMetadata(toGroupJid(groupId));
    return metadata;
  }

  async getAllGroups(sessionId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    // Get all chats and filter for groups
    return { message: 'Use contacts.update event to track groups, or fetch via groupFetchAllParticipating' };
  }

  async getAllGroupsParticipating(sessionId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups);
  }

  async updateGroupName(sessionId: string, groupId: string, name: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    await sock.groupUpdateSubject(toGroupJid(groupId), name);
    return { success: true, name };
  }

  async updateGroupDescription(sessionId: string, groupId: string, description: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    await sock.groupUpdateDescription(toGroupJid(groupId), description);
    return { success: true, description };
  }

  async updateGroupPicture(sessionId: string, groupId: string, imageUrl: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    await sock.updateProfilePicture(toGroupJid(groupId), buffer);
    return { success: true };
  }

  async addParticipants(sessionId: string, groupId: string, participants: string[]) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jids = participants.map(toJid);
    const result = await sock.groupParticipantsUpdate(toGroupJid(groupId), jids, 'add');
    return { success: true, result };
  }

  async removeParticipants(sessionId: string, groupId: string, participants: string[]) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jids = participants.map(toJid);
    const result = await sock.groupParticipantsUpdate(toGroupJid(groupId), jids, 'remove');
    return { success: true, result };
  }

  async promoteParticipants(sessionId: string, groupId: string, participants: string[]) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jids = participants.map(toJid);
    const result = await sock.groupParticipantsUpdate(toGroupJid(groupId), jids, 'promote');
    return { success: true, result };
  }

  async demoteParticipants(sessionId: string, groupId: string, participants: string[]) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jids = participants.map(toJid);
    const result = await sock.groupParticipantsUpdate(toGroupJid(groupId), jids, 'demote');
    return { success: true, result };
  }

  async leaveGroup(sessionId: string, groupId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    await sock.groupLeave(toGroupJid(groupId));
    return { success: true };
  }

  async getInviteLink(sessionId: string, groupId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const code = await sock.groupInviteCode(toGroupJid(groupId));
    return {
      code,
      link: `https://chat.whatsapp.com/${code}`,
    };
  }

  async revokeInviteLink(sessionId: string, groupId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const newCode = await sock.groupRevokeInvite(toGroupJid(groupId));
    return {
      newCode,
      newLink: `https://chat.whatsapp.com/${newCode}`,
    };
  }

  async joinByInviteLink(sessionId: string, inviteCode: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    // Extract code from full URL if needed
    const code = inviteCode.includes('chat.whatsapp.com/')
      ? inviteCode.split('chat.whatsapp.com/')[1]
      : inviteCode;
    const result = await sock.groupAcceptInvite(code);
    return { success: true, groupId: result };
  }

  async getGroupPicture(sessionId: string, groupId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    try {
      const url = await sock.profilePictureUrl(toGroupJid(groupId), 'image');
      return { groupId, profilePictureUrl: url };
    } catch {
      return { groupId, profilePictureUrl: null };
    }
  }

  // Update group settings (who can send messages, who can edit info)
  async updateGroupSettings(
    sessionId: string,
    groupId: string,
    setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked',
  ) {
    const sock = this.sessionsService.getSocket(sessionId);
    await sock.groupSettingUpdate(toGroupJid(groupId), setting);
    return { success: true, setting };
  }
}
