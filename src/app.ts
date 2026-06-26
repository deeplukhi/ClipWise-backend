import crypto from 'crypto';
import express, { Application, Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '@/config/env.config';
import { errorHandler, notFoundHandler } from '@/infrastructure/middleware/error.middleware';
import { createLogger } from '@/infrastructure/utils/logger.util';
import prisma from '@/shared/prisma';

import { deviceMiddleware } from '@/infrastructure/middleware/device.middleware';
import apiRoutes from '@/routes';

const logger = createLogger('App');

// Track active frontend connections
let activeConnections = 0;
const seenOrigins = new Set<string>();

function isFrontendOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (env.CORS_ORIGIN.includes(origin)) return true;
  return /^https?:\/\/localhost(:\d+)?$/.test(origin);
}

export function createApp(): Application {
  const app = express();

  logger.info('Initializing Express application');

  // Request ID — attach unique id to every request
  app.use((req: Request, _res, next) => {
    (req as any).requestId = crypto.randomUUID();
    next();
  });

  app.use(helmet());
  logger.debug('Helmet enabled');

  const allowedOrigins = new Set(env.CORS_ORIGIN);
  const localhostRe = /^https?:\/\/localhost(:\d+)?$/;
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      if (localhostRe.test(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }));
  logger.debug('CORS enabled', { origins: [...allowedOrigins] });

  // Track frontend connections via request logging
  app.use((req: Request, _res, next) => {
    const origin = req.headers.origin;
    if (origin && isFrontendOrigin(origin)) {
      if (!seenOrigins.has(origin)) {
        seenOrigins.add(origin);
        activeConnections++;
        logger.info('Frontend connected', { origin, activeConnections });
      }
    }
    next();
  });

  // Log when a frontend request finishes
  app.use((req: Request, res, next) => {
    const origin = req.headers.origin;
    if (origin && isFrontendOrigin(origin)) {
      res.on('finish', () => {
        logger.info('Frontend request completed', {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          origin,
        });
      });
      res.on('close', () => {
        if (!res.writableFinished) {
          activeConnections = Math.max(0, activeConnections - 1);
          logger.info('Frontend disconnected', { origin, activeConnections });
        }
      });
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(deviceMiddleware);

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    message: 'Too many requests from this IP.',
  });
  app.use(limiter);
  logger.debug('Rate limiting enabled');

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', timestamp: new Date().toISOString(), database: 'disconnected' });
    }
  });

  const apiPrefix = env.API_PREFIX;
  logger.info('Registering API routes', { prefix: apiPrefix });
  app.use(apiPrefix, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
