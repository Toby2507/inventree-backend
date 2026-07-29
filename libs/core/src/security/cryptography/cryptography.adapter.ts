import { SECURITY_CONFIG, type SecurityConfig } from '@app/config';
import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import stringify from 'fast-json-stable-stringify';
import type { Cryptography } from './cryptography.port';

@Injectable()
export class CryptographyAdapter implements Cryptography {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_BYTES = 12; // 96-bit IV — GCM standard
  private readonly TAG_BYTES = 16;

  constructor(@Inject(SECURITY_CONFIG) private readonly config: SecurityConfig) {}

  sha256(data: unknown): string {
    const normalized = typeof data === 'string' ? data : stringify(data);
    return createHash('sha256').update(normalized).digest('hex');
  }

  encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = randomBytes(this.IV_BYTES);
    const cipher = createCipheriv(this.ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  decrypt(ciphertext: string): string {
    const key = this.getKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Invalid ciphertext format');
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(this.ALGORITHM, key, iv, { authTagLength: this.TAG_BYTES });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  randomBytes(size: number): Buffer {
    return randomBytes(size);
  }

  randomToken(size = 32): string {
    return randomBytes(size).toString('base64url');
  }

  private getKey(): Buffer {
    const secret = this.config.cryptographyKey;
    if (!secret) throw new Error('CRYPTOGRAPHY_KEY is not configured');
    const key = Buffer.from(secret, 'hex');
    if (key.length !== 32) throw new Error('CRYPTOGRAPHY_KEY must be 32 bytes (64 hex characters)');
    return key;
  }
}
