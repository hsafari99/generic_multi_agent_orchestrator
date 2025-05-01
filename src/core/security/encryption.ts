import { createCipheriv, createDecipheriv, randomBytes, CipherGCM, DecipherGCM } from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export interface EncryptedMessage {
  encryptedData: string;
  iv: string;
  algorithm: string;
  authTag: string;
}

export class MessageEncryption {
  private readonly config: EncryptionConfig;
  private readonly key: Buffer;

  constructor(key: string, config?: Partial<EncryptionConfig>) {
    this.config = {
      algorithm: config?.algorithm || 'aes-256-gcm',
      keyLength: config?.keyLength || 32,
      ivLength: config?.ivLength || 16,
    };

    // Validate key format
    if (!/^[0-9a-f]{64}$/.test(key)) {
      throw new Error('Invalid encryption key format. Key must be a 32-byte hex string.');
    }

    this.key = Buffer.from(key, 'hex');
  }

  encrypt(data: string): EncryptedMessage {
    const iv = randomBytes(this.config.ivLength);
    const cipher = createCipheriv(this.config.algorithm, this.key, iv) as CipherGCM;

    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

    return {
      encryptedData: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      algorithm: this.config.algorithm,
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(encryptedMessage: EncryptedMessage): string {
    const iv = Buffer.from(encryptedMessage.iv, 'base64');
    const encryptedData = Buffer.from(encryptedMessage.encryptedData, 'base64');
    const authTag = Buffer.from(encryptedMessage.authTag, 'base64');

    const decipher = createDecipheriv(encryptedMessage.algorithm, this.key, iv) as DecipherGCM;
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');
  }

  static generateKey(): string {
    return randomBytes(32).toString('hex');
  }
}
