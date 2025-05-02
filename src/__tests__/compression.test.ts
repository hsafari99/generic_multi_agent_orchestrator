import { MessageCompression, CompressedMessage } from '../core/security/compression';

describe('MessageCompression', () => {
  let compression: MessageCompression;

  beforeEach(() => {
    compression = new MessageCompression();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(compression).toBeInstanceOf(MessageCompression);
    });

    it('should create instance with custom config', () => {
      const customConfig = {
        threshold: 512,
        level: 9,
      };
      const customCompression = new MessageCompression(customConfig);
      expect(customCompression).toBeInstanceOf(MessageCompression);
    });
  });

  describe('compress', () => {
    it('should not compress data below threshold', async () => {
      const data = 'small data';
      const result = await compression.compress(data);

      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
      expect(result.originalSize).toBe(Buffer.byteLength(data, 'utf8'));
      expect(result.compressedSize).toBe(result.originalSize);
    });

    it('should compress data above threshold', async () => {
      const data = 'a'.repeat(2000); // 2KB of data
      const result = await compression.compress(data);

      expect(result.compressed).toBe(true);
      expect(result.data).not.toBe(data);
      expect(result.originalSize).toBe(Buffer.byteLength(data, 'utf8'));
      expect(result.compressedSize).toBeLessThan(result.originalSize);
    });

    it('should handle empty string', async () => {
      const data = '';
      const result = await compression.compress(data);

      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
      expect(result.originalSize).toBe(0);
      expect(result.compressedSize).toBe(0);
    });

    it('should handle special characters', async () => {
      const data = '!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./';
      const result = await compression.compress(data);

      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
    });

    it('should handle unicode characters', async () => {
      const data = '你好世界 🚀';
      const result = await compression.compress(data);

      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
    });
  });

  describe('decompress', () => {
    it('should decompress compressed data', async () => {
      const originalData = 'a'.repeat(2000);
      const compressed = await compression.compress(originalData);
      const decompressed = await compression.decompress(compressed);

      expect(decompressed).toBe(originalData);
    });

    it('should return original data if not compressed', async () => {
      const data = 'small data';
      const compressed = await compression.compress(data);
      const decompressed = await compression.decompress(compressed);

      expect(decompressed).toBe(data);
    });

    it('should handle empty string', async () => {
      const data = '';
      const compressed = await compression.compress(data);
      const decompressed = await compression.decompress(compressed);

      expect(decompressed).toBe(data);
    });

    it('should throw error for invalid compressed data', async () => {
      const invalidMessage: CompressedMessage = {
        compressed: true,
        data: 'invalid-base64-data',
        originalSize: 100,
        compressedSize: 50,
      };

      await expect(compression.decompress(invalidMessage)).rejects.toThrow();
    });
  });

  describe('getCompressionRatio', () => {
    it('should return 1 for uncompressed data', async () => {
      const data = 'small data';
      const compressed = await compression.compress(data);
      const ratio = compression.getCompressionRatio(compressed);

      expect(ratio).toBe(1);
    });

    it('should return ratio less than 1 for compressed data', async () => {
      const data = 'a'.repeat(2000);
      const compressed = await compression.compress(data);
      const ratio = compression.getCompressionRatio(compressed);

      expect(ratio).toBeLessThan(1);
    });

    it('should handle edge case with zero size', async () => {
      const data = '';
      const compressed = await compression.compress(data);
      const ratio = compression.getCompressionRatio(compressed);

      expect(ratio).toBe(1);
    });
  });

  describe('end-to-end compression', () => {
    it('should handle various data types', async () => {
      const testCases = [
        'simple text',
        'text with special chars: !@#$%^&*()',
        'text with emoji: 🚀',
        'text with unicode: 你好世界',
        'text with numbers: 1234567890',
        'text with spaces:   multiple   spaces  ',
        'text with newlines: \n\r\n',
        'text with tabs: \t\t',
      ];

      for (const data of testCases) {
        const compressed = await compression.compress(data);
        const decompressed = await compression.decompress(compressed);
        expect(decompressed).toBe(data);
      }
    });

    it('should handle large data', async () => {
      const data = 'a'.repeat(100000); // 100KB of data
      const compressed = await compression.compress(data);
      const decompressed = await compression.decompress(compressed);

      expect(decompressed).toBe(data);
      expect(compressed.compressed).toBe(true);
      expect(compressed.compressedSize).toBeLessThan(compressed.originalSize);
    });

    it('should handle repeated patterns', async () => {
      const data = 'hello world '.repeat(1000);
      const compressed = await compression.compress(data);
      const decompressed = await compression.decompress(compressed);

      expect(decompressed).toBe(data);
      expect(compressed.compressed).toBe(true);
      expect(compressed.compressedSize).toBeLessThan(compressed.originalSize);
    });
  });
});
