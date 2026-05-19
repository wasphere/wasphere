import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';

function toJid(number: string): string {
  if (number.includes('@')) return number;
  const clean = number.replace(/[^0-9]/g, '');
  return `${clean}@s.whatsapp.net`;
}

@Injectable()
export class ContactsService {
  constructor(private sessionsService: SessionsService) {}

  // Check if number is on WhatsApp
  async checkNumber(sessionId: string, number: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(number);
    const [result] = await sock.onWhatsApp(number.replace(/[^0-9]/g, ''));
    return {
      number,
      jid: result?.jid,
      isOnWhatsApp: result?.exists || false,
      isBusiness: (result as any)?.isBusiness || false,
    };
  }

  // Check multiple numbers at once
  async checkNumbers(sessionId: string, numbers: string[]) {
    const results = await Promise.all(
      numbers.map((n) => this.checkNumber(sessionId, n))
    );
    return results;
  }

  // Get contact's profile picture URL
  async getProfilePicture(sessionId: string, number: string, highRes: boolean = false) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(number);
    try {
      const url = await sock.profilePictureUrl(jid, highRes ? 'image' : 'preview');
      return { jid, profilePictureUrl: url };
    } catch {
      return { jid, profilePictureUrl: null };
    }
  }

  // Get contact's about/status text
  async getAbout(sessionId: string, number: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(number);
    try {
      const status = await sock.fetchStatus(jid) as any;
      return { jid, about: status?.status || null, setAt: status?.setAt };
    } catch {
      return { jid, about: null };
    }
  }

  // Block a contact
  async blockContact(sessionId: string, number: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(number);
    await sock.updateBlockStatus(jid, 'block');
    return { jid, blocked: true };
  }

  // Unblock a contact
  async unblockContact(sessionId: string, number: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(number);
    await sock.updateBlockStatus(jid, 'unblock');
    return { jid, blocked: false };
  }

  // Subscribe to contact's presence (to see online/typing/last seen)
  async subscribePresence(sessionId: string, number: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(number);
    await sock.presenceSubscribe(jid);
    return { jid, subscribed: true };
  }

  // Get own account profile info
  async getOwnProfile(sessionId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const user = sock.user;
    return {
      jid: user?.id,
      name: user?.name,
      phoneNumber: user?.id?.split(':')[0],
    };
  }

  // Update own profile name
  async updateName(sessionId: string, name: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    await sock.updateProfileName(name);
    return { success: true, name };
  }

  // Update own about/status
  async updateAbout(sessionId: string, about: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    await sock.updateProfileStatus(about);
    return { success: true, about };
  }

  // Update own profile picture (from URL)
  async updateProfilePicture(sessionId: string, imageUrl: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    await sock.updateProfilePicture(sock.user!.id, buffer);
    return { success: true };
  }

  // Remove own profile picture
  async removeProfilePicture(sessionId: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    await sock.removeProfilePicture(sock.user!.id);
    return { success: true };
  }
}
