import { Inject, Injectable } from '@nestjs/common';
import {
  WHATSAPP_ADAPTER,
  IWhatsAppAdapter,
  ContactCheckResult,
  ProfileInfo,
} from '../whatsapp/whatsapp-adapter.interface';

@Injectable()
export class ContactsService {
  constructor(
    @Inject(WHATSAPP_ADAPTER) private adapter: IWhatsAppAdapter,
  ) {}

  async checkNumber(sessionId: string, number: string): Promise<ContactCheckResult> {
    return this.adapter.checkNumber(sessionId, number);
  }

  async checkNumbers(sessionId: string, numbers: string[]): Promise<ContactCheckResult[]> {
    return this.adapter.checkNumbers(sessionId, numbers);
  }

  async getProfilePicture(
    sessionId: string,
    number: string,
    highRes: boolean = false,
  ): Promise<{ jid: string; profilePictureUrl: string | null }> {
    return this.adapter.getContactProfilePicture(sessionId, number, highRes);
  }

  async getAbout(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; about: string | null; setAt?: Date }> {
    return this.adapter.getContactAbout(sessionId, number);
  }

  async blockContact(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; blocked: boolean }> {
    return this.adapter.blockContact(sessionId, number);
  }

  async unblockContact(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; blocked: boolean }> {
    return this.adapter.unblockContact(sessionId, number);
  }

  async subscribePresence(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; subscribed: boolean }> {
    return this.adapter.subscribePresence(sessionId, number);
  }

  async getOwnProfile(sessionId: string): Promise<ProfileInfo> {
    return this.adapter.getOwnProfile(sessionId);
  }

  async updateName(sessionId: string, name: string): Promise<{ success: boolean; name: string }> {
    return this.adapter.updateOwnName(sessionId, name);
  }

  async updateAbout(sessionId: string, about: string): Promise<{ success: boolean; about: string }> {
    return this.adapter.updateOwnAbout(sessionId, about);
  }

  async updateProfilePicture(sessionId: string, imageUrl: string): Promise<{ success: boolean }> {
    return this.adapter.updateOwnProfilePicture(sessionId, imageUrl);
  }

  async removeProfilePicture(sessionId: string): Promise<{ success: boolean }> {
    return this.adapter.removeOwnProfilePicture(sessionId);
  }
}
