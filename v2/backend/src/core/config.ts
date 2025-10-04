import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform(Number).pipe(z.number().min(1).max(65535)),
  HOST: z.string().default('0.0.0.0'),

  // Security
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(32),
  ADMIN_SESSION_TIMEOUT: z.string().default('86400000').transform(Number).pipe(z.number()),
  API_KEY_PREFIX: z.string().default('cr_'),

  // Admin Credentials (optional, auto-generated if not set)
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number).pipe(z.number()),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.string().default('1').transform(Number).pipe(z.number().min(0).max(15)),
  REDIS_ENABLE_TLS: z.string().default('false').transform((v) => v === 'true'),

  // Session Management
  STICKY_SESSION_TTL_HOURS: z.string().default('1').transform(Number).pipe(z.number()),
  STICKY_SESSION_RENEWAL_THRESHOLD_MINUTES: z.string().default('15').transform(Number).pipe(z.number()),

  // Claude API Configuration
  CLAUDE_API_URL: z.string().default('https://api.anthropic.com/v1/messages'),
  CLAUDE_API_VERSION: z.string().default('2023-06-01'),
  CLAUDE_BETA_HEADER: z.string().default('claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'),
  CLAUDE_OVERLOAD_HANDLING_MINUTES: z.string().default('0').transform(Number).pipe(z.number()),

  // Proxy Configuration
  DEFAULT_PROXY_TIMEOUT: z.string().default('600000').transform(Number).pipe(z.number()),
  MAX_PROXY_RETRIES: z.string().default('3').transform(Number).pipe(z.number()),
  PROXY_USE_IPV4: z.string().default('true').transform((v) => v === 'true'),

  // Request Configuration
  REQUEST_TIMEOUT: z.string().default('600000').transform(Number).pipe(z.number()),

  // Usage Limits
  DEFAULT_TOKEN_LIMIT: z.string().default('1000000').transform(Number).pipe(z.number()),

  // Timezone
  TIMEZONE_OFFSET: z
    .string()
    .default('8')
    .transform((v) => Number(v))
    .pipe(z.number().min(-12).max(14)),

  // Metrics
  METRICS_WINDOW: z.string().default('5').transform(Number).pipe(z.number().min(1).max(60)),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string().default('true').transform((v) => v === 'true'),
  LOG_MAX_SIZE: z.string().default('10m'),
  LOG_MAX_FILES: z.string().default('5'),

  // System Configuration
  CLEANUP_INTERVAL: z.string().default('3600000').transform(Number).pipe(z.number()),
  TOKEN_USAGE_RETENTION: z.string().default('2592000000').transform(Number).pipe(z.number()),
  HEALTH_CHECK_INTERVAL: z.string().default('60000').transform(Number).pipe(z.number()),

  // Web Interface
  WEB_TITLE: z.string().default('Claude Relay Service'),
  WEB_DESCRIPTION: z.string().default('Multi-account Claude API relay service with beautiful management interface'),
  WEB_LOGO_URL: z.string().default('/assets/logo.png'),

  // Development
  DEBUG: z.string().default('false').transform((v) => v === 'true'),
  DEBUG_HTTP_TRAFFIC: z.string().default('false').transform((v) => v === 'true'),
  ENABLE_CORS: z.string().default('true').transform((v) => v === 'true'),
  TRUST_PROXY: z.string().default('true').transform((v) => v === 'true'),

  // Client Restrictions
  ALLOW_CUSTOM_CLIENTS: z.string().default('true').transform((v) => v === 'true'),

  // LDAP Authentication (optional)
  LDAP_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  LDAP_URL: z.string().optional(),
  LDAP_BIND_DN: z.string().optional(),
  LDAP_BIND_PASSWORD: z.string().optional(),
  LDAP_SEARCH_BASE: z.string().optional(),
  LDAP_SEARCH_FILTER: z.string().default('(uid={{username}})'),
  LDAP_SEARCH_ATTRIBUTES: z.string().default('dn,uid,cn,mail,givenName,sn'),
  LDAP_TIMEOUT: z.string().default('5000').transform(Number).pipe(z.number()),
  LDAP_CONNECT_TIMEOUT: z.string().default('10000').transform(Number).pipe(z.number()),
  LDAP_TLS_REJECT_UNAUTHORIZED: z.string().default('true').transform((v) => v === 'true'),
  LDAP_TLS_CA_FILE: z.string().optional(),
  LDAP_TLS_CERT_FILE: z.string().optional(),
  LDAP_TLS_KEY_FILE: z.string().optional(),
  LDAP_TLS_SERVERNAME: z.string().optional(),
  LDAP_USER_ATTR_USERNAME: z.string().default('uid'),
  LDAP_USER_ATTR_DISPLAY_NAME: z.string().default('cn'),
  LDAP_USER_ATTR_EMAIL: z.string().default('mail'),
  LDAP_USER_ATTR_FIRST_NAME: z.string().default('givenName'),
  LDAP_USER_ATTR_LAST_NAME: z.string().default('sn'),

  // User Management
  USER_MANAGEMENT_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  DEFAULT_USER_ROLE: z.string().default('user'),
  USER_SESSION_TIMEOUT: z.string().default('86400000').transform(Number).pipe(z.number()),
  MAX_API_KEYS_PER_USER: z.string().default('1').transform(Number).pipe(z.number()),
  ALLOW_USER_DELETE_API_KEYS: z.string().default('false').transform((v) => v === 'true')
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
