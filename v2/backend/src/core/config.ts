import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('4000'),
  HOST: z.string().default('0.0.0.0'),

  // Security
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(32),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number()).default('6379'),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.string().transform(Number).pipe(z.number().min(0).max(15)).default('1'),
  REDIS_ENABLE_TLS: z.string().transform((v) => v === 'true').default('false'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string().transform((v) => v === 'true').default('true'),

  // Development
  DEBUG: z.string().transform((v) => v === 'true').default('false')
})

const parseEnv = () => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    process.exit(1)
  }
}

export const config = parseEnv()

export const isDev = config.NODE_ENV === 'development'
export const isProd = config.NODE_ENV === 'production'
export const isTest = config.NODE_ENV === 'test'
