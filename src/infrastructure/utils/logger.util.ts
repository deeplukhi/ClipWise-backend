import winston from 'winston';
import { env } from '@/config/env.config';

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

export function createLogger(label: string) {
  return {
    info: (message: string, meta?: any) => logger.info(`[${label}] ${message}`, meta),
    warn: (message: string, meta?: any) => logger.warn(`[${label}] ${message}`, meta),
    error: (message: string, error?: any, meta?: any) => logger.error(`[${label}] ${message}`, { error, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(`[${label}] ${message}`, meta),
  };
}
