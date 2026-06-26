import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string(),
  CORS_ORIGIN: z.string().default('http://localhost:3001').transform((val) => val.split(',').map((url) => url.trim())),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENROUTER_MODEL: z.string().default('openrouter/free'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  SHARE_BASE_URL: z.string().default('http://localhost:3001/share'),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment Configuration Error:');
      error.errors.forEach((err) => console.error(`  ${err.path.join('.')}: ${err.message}`));
      console.error('\nCheck your .env file.');
      process.exit(1);
    }
    throw error;
  }
};

export const env = parseEnv();
