import { CacheManager } from '../src/core/cache/manager';
import { RedisClient } from '../src/core/cache/client';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

async function testRedisConnection() {
  try {
    console.log('Testing Redis connection...');

    // Get Redis client instance and connect
    const redisClient = RedisClient.getInstance();
    await redisClient.connect();

    // Get cache manager instance
    const cache = CacheManager.getInstance();

    // Test basic operations
    console.log('Setting test value...');
    await cache.set('test:key', { message: 'Hello Redis!' });

    console.log('Getting test value...');
    const value = await cache.get('test:key');
    console.log('Retrieved value:', value);

    console.log('Checking if key exists...');
    const exists = await cache.exists('test:key');
    console.log('Key exists:', exists);

    console.log('Deleting test value...');
    await cache.delete('test:key');

    console.log('Verifying deletion...');
    const existsAfterDelete = await cache.exists('test:key');
    console.log('Key exists after deletion:', existsAfterDelete);

    // Disconnect from Redis
    await redisClient.disconnect();

    console.log('Redis connection test completed successfully!');
  } catch (error) {
    console.error('Redis connection test failed:', error);
    process.exit(1);
  }
}

// Run the test
testRedisConnection();
