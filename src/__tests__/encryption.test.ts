import { MessageEncryption, EncryptedMessage } from '../core/security/encryption';

describe('MessageEncryption', () => {
  let encryption: MessageEncryption;
  const testKey = MessageEncryption.generateKey();

  beforeEach(() => {
    encryption = new MessageEncryption(testKey);
  });

  describe('encrypt', () => {
    it('should encrypt data', () => {
      const data = 'test message';
      const encrypted = encryption.encrypt(data);

      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('algorithm');
      expect(encrypted.algorithm).toBe('aes-256-gcm');
    });

    it('should generate different IVs for same data', () => {
      const data = 'test message';
      const encrypted1 = encryption.encrypt(data);
      const encrypted2 = encryption.encrypt(data);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data', () => {
      const originalData = 'test message';
      const encrypted = encryption.encrypt(originalData);
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe(originalData);
    });

    it('should throw error for invalid encrypted data', () => {
      const invalidMessage: EncryptedMessage = {
        encryptedData: 'invalid',
        iv: 'invalid',
        algorithm: 'aes-256-gcm',
        authTag: 'invalid',
      };

      expect(() => encryption.decrypt(invalidMessage)).toThrow();
    });
  });

  describe('generateKey', () => {
    it('should generate different keys', () => {
      const key1 = MessageEncryption.generateKey();
      const key2 = MessageEncryption.generateKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate keys of correct length', () => {
      const key = MessageEncryption.generateKey();
      expect(key.length).toBe(64); // 32 bytes in hex
    });
  });
});
