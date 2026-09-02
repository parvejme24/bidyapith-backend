import Redis from 'ioredis';
import { config } from '../config';

let client: Redis | null | undefined;

export const getRedis = (): Redis | null => {
  if (client !== undefined) {
    return client;
  }

  if (config.REDIS_URL.length === 0) {
    client = null;
    return client;
  }

  client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  client.on('error', (error: Error) => {
    console.error('[redis]', error.message);
  });

  return client;
};

export const disconnectRedis = async (): Promise<void> => {
  if (client === null || client === undefined) {
    return;
  }
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
  client = undefined;
};
