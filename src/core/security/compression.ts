import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface CompressionConfig {
  threshold: number; // Minimum size in bytes to trigger compression
  level: number; // Compression level (1-9)
}

export interface CompressedMessage {
  compressed: boolean;
  data: string;
  originalSize: number;
  compressedSize: number;
}

export class MessageCompression {
  private readonly config: CompressionConfig;

  constructor(config?: Partial<CompressionConfig>) {
    this.config = {
      threshold: config?.threshold || 1024, // 1KB default threshold
      level: config?.level || 6, // Default compression level
    };
  }

  async compress(data: string): Promise<CompressedMessage> {
    const originalSize = Buffer.byteLength(data, 'utf8');

    // Only compress if data size exceeds threshold
    if (originalSize < this.config.threshold) {
      return {
        compressed: false,
        data,
        originalSize,
        compressedSize: originalSize,
      };
    }

    const compressed = await gzipAsync(data, { level: this.config.level });
    const compressedSize = compressed.length;

    return {
      compressed: true,
      data: compressed.toString('base64'),
      originalSize,
      compressedSize,
    };
  }

  async decompress(message: CompressedMessage): Promise<string> {
    if (!message.compressed) {
      return message.data;
    }

    const compressed = Buffer.from(message.data, 'base64');
    const decompressed = await gunzipAsync(compressed);
    return decompressed.toString('utf8');
  }

  getCompressionRatio(message: CompressedMessage): number {
    return message.compressedSize / message.originalSize;
  }
}
