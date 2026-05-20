import { Inject, Injectable } from '@nestjs/common';
import {
  WHATSAPP_ADAPTER,
  IWhatsAppAdapter,
  GroupInfo,
  GroupSetting,
} from '../whatsapp/whatsapp-adapter.interface';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(WHATSAPP_ADAPTER) private adapter: IWhatsAppAdapter,
  ) {}

  async createGroup(
    sessionId: string,
    name: string,
    participants: string[],
  ): Promise<{ groupId: string; name: string; participants: string[] }> {
    return this.adapter.createGroup(sessionId, name, participants);
  }

  async getGroupInfo(sessionId: string, groupId: string): Promise<GroupInfo> {
    return this.adapter.getGroupInfo(sessionId, groupId);
  }

  async getAllGroupsParticipating(sessionId: string): Promise<GroupInfo[]> {
    return this.adapter.getAllGroupsParticipating(sessionId);
  }

  async updateGroupName(
    sessionId: string,
    groupId: string,
    name: string,
  ): Promise<{ success: boolean; name: string }> {
    return this.adapter.updateGroupName(sessionId, groupId, name);
  }

  async updateGroupDescription(
    sessionId: string,
    groupId: string,
    description: string,
  ): Promise<{ success: boolean; description: string }> {
    return this.adapter.updateGroupDescription(sessionId, groupId, description);
  }

  async updateGroupPicture(
    sessionId: string,
    groupId: string,
    imageUrl: string,
  ): Promise<{ success: boolean }> {
    return this.adapter.updateGroupPicture(sessionId, groupId, imageUrl);
  }

  async addParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }> {
    return this.adapter.addParticipants(sessionId, groupId, participants);
  }

  async removeParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }> {
    return this.adapter.removeParticipants(sessionId, groupId, participants);
  }

  async promoteParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }> {
    return this.adapter.promoteParticipants(sessionId, groupId, participants);
  }

  async demoteParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }> {
    return this.adapter.demoteParticipants(sessionId, groupId, participants);
  }

  async leaveGroup(sessionId: string, groupId: string): Promise<{ success: boolean }> {
    return this.adapter.leaveGroup(sessionId, groupId);
  }

  async getInviteLink(
    sessionId: string,
    groupId: string,
  ): Promise<{ code: string; link: string }> {
    return this.adapter.getGroupInviteLink(sessionId, groupId);
  }

  async revokeInviteLink(
    sessionId: string,
    groupId: string,
  ): Promise<{ newCode: string; newLink: string }> {
    return this.adapter.revokeGroupInviteLink(sessionId, groupId);
  }

  async joinByInviteLink(
    sessionId: string,
    inviteCode: string,
  ): Promise<{ success: boolean; groupId: string }> {
    return this.adapter.joinGroupByInviteLink(sessionId, inviteCode);
  }

  async getGroupPicture(
    sessionId: string,
    groupId: string,
  ): Promise<{ groupId: string; profilePictureUrl: string | null }> {
    return this.adapter.getGroupPicture(sessionId, groupId);
  }

  async updateGroupSettings(
    sessionId: string,
    groupId: string,
    setting: GroupSetting,
  ): Promise<{ success: boolean; setting: GroupSetting }> {
    return this.adapter.updateGroupSettings(sessionId, groupId, setting);
  }
}
