/**
 * Redis Key 命名规范
 * 严格遵循 v1 的命名规则
 */

/**
 * Redis Key 前缀（v2 使用独立 DB，可以不加 v2 前缀）
 */
export const REDIS_KEYS = {
  // API Key 相关
  API_KEY: (keyId: string) => `apikey:${keyId}`,
  API_KEY_HASH_MAP: 'apikey:hash_map',

  // 账户相关
  CLAUDE_CONSOLE_ACCOUNT: (accountId: string) => `claude_console_account:${accountId}`,
  CODEX_ACCOUNT: (accountId: string) => `codex_account:${accountId}`,
  SHARED_CLAUDE_CONSOLE_ACCOUNTS: 'shared_claude_console_accounts',
  SHARED_CODEX_ACCOUNTS: 'shared_codex_accounts',

  // 使用统计相关
  USAGE: (keyId: string) => `usage:${keyId}`,
  USAGE_DAILY: (keyId: string, date: string) => `usage:daily:${keyId}:${date}`,
  USAGE_MONTHLY: (keyId: string, month: string) => `usage:monthly:${keyId}:${month}`,
  USAGE_HOURLY: (keyId: string, hour: string) => `usage:hourly:${keyId}:${hour}`,

  // 模型统计
  USAGE_MODEL_DAILY: (model: string, date: string) => `usage:model:daily:${model}:${date}`,
  USAGE_MODEL_MONTHLY: (model: string, month: string) => `usage:model:monthly:${model}:${month}`,
  USAGE_MODEL_HOURLY: (model: string, hour: string) => `usage:model:hourly:${model}:${hour}`,

  // API Key 模型统计
  USAGE_KEY_MODEL_DAILY: (keyId: string, model: string, date: string) =>
    `usage:${keyId}:model:daily:${model}:${date}`,
  USAGE_KEY_MODEL_MONTHLY: (keyId: string, model: string, month: string) =>
    `usage:${keyId}:model:monthly:${model}:${month}`,
  USAGE_KEY_MODEL_HOURLY: (keyId: string, model: string, hour: string) =>
    `usage:${keyId}:model:hourly:${model}:${hour}`,

  // 账户使用统计
  ACCOUNT_USAGE: (accountId: string) => `account_usage:${accountId}`,
  ACCOUNT_USAGE_DAILY: (accountId: string, date: string) =>
    `account_usage:daily:${accountId}:${date}`,
  ACCOUNT_USAGE_MODEL_DAILY: (accountId: string, model: string, date: string) =>
    `account_usage:${accountId}:model:daily:${model}:${date}`,

  // 费用统计
  COST_DAILY: (keyId: string, date: string) => `cost:daily:${keyId}:${date}`,
  COST_WEEKLY: (keyId: string, week: string) => `cost:weekly:${keyId}:${week}`,
  COST_MONTHLY: (keyId: string, month: string) => `cost:monthly:${keyId}:${month}`,
  COST_WEEKLY_OPUS: (keyId: string, week: string) => `cost:weekly_opus:${keyId}:${week}`,

  // 使用记录
  USAGE_RECORDS: (keyId: string) => `usage:records:${keyId}`,

  // 速率限制
  RATE_LIMIT_REQUESTS: (keyId: string) => `rate_limit:requests:${keyId}`,
  RATE_LIMIT_TOKENS: (keyId: string) => `rate_limit:tokens:${keyId}`,
  RATE_LIMIT_COST: (keyId: string) => `rate_limit:cost:${keyId}`,
  RATE_LIMIT_WINDOW_START: (keyId: string) => `rate_limit:window_start:${keyId}`,

  // 并发控制
  CONCURRENCY: (keyId: string) => `concurrency:${keyId}`,

  // 会话映射
  UNIFIED_CLAUDE_SESSION_MAPPING: (sessionHash: string) =>
    `unified_claude_session_mapping:${sessionHash}`,

  // 系统指标
  SYSTEM_METRICS_MINUTE: (minuteTimestamp: number) => `system:metrics:minute:${minuteTimestamp}`,

  // 管理员相关
  ADMIN_CREDENTIALS: 'admin:credentials'
} as const

/**
 * Redis Key 模式（用于查询）
 */
export const REDIS_KEY_PATTERNS = {
  ALL_API_KEYS: 'apikey:*',
  ALL_CLAUDE_CONSOLE_ACCOUNTS: 'claude_console_account:*',
  ALL_CODEX_ACCOUNTS: 'codex_account:*',
  ALL_USAGE_KEYS: (keyId: string) => `usage:*:${keyId}*`,
  ALL_COST_KEYS: (keyId: string) => `cost:*:${keyId}*`
} as const
