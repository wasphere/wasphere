import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const keyHex = process.env.ENCRYPTION_KEY ?? '';
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).',
      );
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([tag, encrypted]);
    return {
      ciphertext: combined.toString('hex'),
      iv: iv.toString('hex'),
    };
  }

  decrypt(ciphertextHex: string, ivHex: string): string {
    const combined = Buffer.from(ciphertextHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = combined.subarray(0, 16);
    const ciphertext = combined.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    try {
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      throw new Error('GCM_AUTH_TAG_MISMATCH');
    }
  }
}
