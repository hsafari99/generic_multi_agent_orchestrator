import { MessageEncryption } from '../core/security/encryption';

describe('MessageEncryption', () => {
  const validKey = '1234567890123456789012345678901234567890123456789012345678901234';
  let encryption: MessageEncryption;

  beforeEach(() => {
    encryption = new MessageEncryption(validKey);
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(encryption).toBeInstanceOf(MessageEncryption);
    });

    it('should create instance with custom config', () => {
      const customConfig = {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
      };
      const customEncryption = new MessageEncryption(validKey, customConfig);
      expect(customEncryption).toBeInstanceOf(MessageEncryption);
    });

    it('should throw error for invalid key format', () => {
      expect(() => new MessageEncryption('invalid-key')).toThrow('Invalid encryption key format');
    });
  });

  describe('encrypt', () => {
    it('should encrypt message successfully', () => {
      const message = 'test message';
      const encrypted = encryption.encrypt(message);

      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('algorithm');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted.algorithm).toBe('aes-256-gcm');
    });

    it('should generate different IV for each encryption', () => {
      const message = 'test message';
      const encrypted1 = encryption.encrypt(message);
      const encrypted2 = encryption.encrypt(message);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
    });
  });

  describe('decrypt', () => {
    it('should decrypt message successfully', () => {
      const originalMessage = 'test message';
      const encrypted = encryption.encrypt(originalMessage);
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe(originalMessage);
    });

    it('should throw error for tampered message', () => {
      const encrypted = encryption.encrypt('test message');
      encrypted.encryptedData = 'tampered-data';

      expect(() => encryption.decrypt(encrypted)).toThrow();
    });

    it('should throw error for invalid IV', () => {
      const encrypted = encryption.encrypt('test message');
      encrypted.iv = 'invalid-iv';

      expect(() => encryption.decrypt(encrypted)).toThrow();
    });

    it('should throw error for invalid auth tag', () => {
      const encrypted = encryption.encrypt('test message');
      encrypted.authTag = 'invalid-tag';

      expect(() => encryption.decrypt(encrypted)).toThrow();
    });
  });

  describe('generateKey', () => {
    it('should generate valid key', () => {
      const key = MessageEncryption.generateKey();
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate different keys each time', () => {
      const key1 = MessageEncryption.generateKey();
      const key2 = MessageEncryption.generateKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('end-to-end encryption', () => {
    it('should handle various message types', () => {
      const messages = [
        'simple text',
        'text with special chars: !@#$%^&*()',
        'text with emoji: 🚀',
        'text with unicode: 你好世界',
        'text with numbers: 1234567890',
        'text with spaces:   multiple   spaces  ',
        'text with newlines: \n\r\n',
        'text with tabs: \t\t',
      ];

      messages.forEach(message => {
        const encrypted = encryption.encrypt(message);
        const decrypted = encryption.decrypt(encrypted);
        expect(decrypted).toBe(message);
      });
    });

    it('should handle empty message', () => {
      const message = '';
      const encrypted = encryption.encrypt(message);
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(message);
    });

    it('should handle long message', () => {
      const message = 'a'.repeat(10000);
      const encrypted = encryption.encrypt(message);
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(message);
    });
  });
});
