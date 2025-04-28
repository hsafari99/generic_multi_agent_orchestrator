import { MessageCompression, CompressedMessage } from '../core/security/compression';

describe('MessageCompression', () => {
  let compression: MessageCompression;

  beforeEach(() => {
    compression = new MessageCompression({
      threshold: 100, // 100 bytes threshold for testing
      level: 6,
    });
  });

  describe('compress', () => {
    it('should not compress data below threshold', async () => {
      const data = 'small message';
      const result = await compression.compress(data);

      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
      expect(result.originalSize).toBe(result.compressedSize);
    });

    it('should compress data above threshold', async () => {
      // Create a large message
      const data = 'x'.repeat(200);
      const result = await compression.compress(data);

      expect(result.compressed).toBe(true);
      expect(result.data).not.toBe(data);
      expect(result.compressedSize).toBeLessThan(result.originalSize);
    });

    it('should maintain data integrity after compression', async () => {
      const data = 'x'.repeat(200);
      const compressed = await compression.compress(data);
      const decompressed = await compression.decompress(compressed);

      expect(decompressed).toBe(data);
    });
  });

  describe('decompress', () => {
    it('should return original data for uncompressed messages', async () => {
      const message: CompressedMessage = {
        compressed: false,
        data: 'test message',
        originalSize: 12,
        compressedSize: 12,
      };

      const result = await compression.decompress(message);
      expect(result).toBe('test message');
    });

    it('should decompress compressed messages', async () => {
      const data = 'x'.repeat(200);
      const compressed = await compression.compress(data);
      const decompressed = await compression.decompress(compressed);

      expect(decompressed).toBe(data);
    });
  });

  describe('getCompressionRatio', () => {
    it('should return 1 for uncompressed messages', async () => {
      const data = 'small message';
      const result = await compression.compress(data);

      expect(compression.getCompressionRatio(result)).toBe(1);
    });

    it('should return ratio less than 1 for compressed messages', async () => {
      const data = 'x'.repeat(200);
      const result = await compression.compress(data);

      expect(compression.getCompressionRatio(result)).toBeLessThan(1);
    });
  });
});
