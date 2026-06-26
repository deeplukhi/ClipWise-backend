import Queue from 'bull';
import { env } from '@/config/env.config';
import { createLogger } from '@/infrastructure/utils/logger.util';

const logger = createLogger('Queue');

let _available = false;
let _queue: Queue.Queue<{ youtubeUrl: string }> | null = null;

async function initQueue(): Promise<void> {
  const q = new Queue('summarize', {
    redis: { host: env.REDIS_HOST, port: env.REDIS_PORT, maxRetriesPerRequest: 1 },
    settings: { stalledInterval: 30000 },
  });

  try {
    await q.isReady();
    _queue = q;
    _available = true;
    logger.info('Redis connected — background queue enabled');

    q.on('error', (err: Error) => {
      if (_available && err.message !== 'Connection is closed.') {
        logger.warn('Redis connection lost — falling back to sync mode');
        _available = false;
      }
    });
  } catch {
    logger.warn('Redis unavailable — falling back to synchronous processing');
    q.close();
  }
}

function isQueueAvailable(): boolean {
  return _available;
}

function getQueue(): Queue.Queue<{ youtubeUrl: string }> | null {
  return _queue;
}

export { initQueue, isQueueAvailable, getQueue };
