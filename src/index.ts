import http from 'http';
import { createApp } from './app';
import { env } from '@/config/env.config';
import prisma from '@/shared/prisma';
import { initSocket } from '@/infrastructure/socket';
import { initQueue, isQueueAvailable } from '@/infrastructure/queue/queue';
import { startSummarizeWorker } from '@/infrastructure/queue/summarize.worker';
import { createLogger } from '@/infrastructure/utils/logger.util';

const logger = createLogger('Bootstrap');

async function bootstrap() {
  try {
    logger.info('Starting ClipWise backend');

    await prisma.$connect();
    logger.info('Database connected');

    await initQueue();

    const app = createApp();
    const httpServer = http.createServer(app);

    initSocket(httpServer);
    logger.info('Socket.IO initialized');

    if (isQueueAvailable()) {
      startSummarizeWorker();
    } else {
      logger.info('Starting in sync mode (no Redis)');
    }

    const PORT = env.PORT;
    httpServer.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        environment: env.NODE_ENV,
        apiUrl: `http://localhost:${PORT}${env.API_PREFIX}`,
        mode: isQueueAvailable() ? 'async (Redis)' : 'sync',
      });
    });

    const gracefulShutdown = async (signal: string) => {
      logger.warn('Shutdown signal received', { signal });
      const timeout = setTimeout(() => {
        logger.error('Forced exit after timeout');
        process.exit(1);
      }, 10_000);
      timeout.unref();
      await prisma.$disconnect();
      clearTimeout(timeout);
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { message: error?.message, stack: error?.stack });
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      const msg = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      logger.error('Unhandled Rejection', { message: msg, stack });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

bootstrap();
