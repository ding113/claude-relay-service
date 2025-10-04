/**
 * 使用统计数据结构定义
 * 对应 v1 的 redis.js 中的统计相关方法
 */

/**
 * Usage 数据（单次请求）
 */
export interface UsageData {
  inputTokens: number
  outputTokens: number
  cacheCreateTokens: number
  cacheReadTokens: number
  ephemeral5mTokens?: number
  ephemeral1hTokens?: number
  model: string
  isLongContextRequest?: boolean
}

/**
 * Usage 对象（Claude API 返回格式）
 */
export interface UsageObject {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: {
    ephemeral_5m_input_tokens?: number
    ephemeral_1h_input_tokens?: number
  }
}

/**
 * Token 统计
 */
export interface TokenStats {
  total: number
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  ephemeral5m?: number
  ephemeral1h?: number
}

/**
 * 使用统计（总计）
 */
export interface UsageStats {
  // 总计
  total: {
    requests: number
    tokens: number // 核心 tokens（input + output）
    allTokens: number // 所有 tokens（包括缓存）
    inputTokens: number
    outputTokens: number
    cacheCreateTokens: number
    cacheReadTokens: number
    ephemeral5mTokens?: number
    ephemeral1hTokens?: number
    longContextInputTokens?: number
    longContextOutputTokens?: number
    longContextRequests?: number
    cost?: number
  }

  // 每日统计
  daily?: {
    requests: number
    tokens: number
    allTokens: number
    inputTokens: number
    outputTokens: number
    cacheCreateTokens: number
    cacheReadTokens: number
    ephemeral5mTokens?: number
    ephemeral1hTokens?: number
    longContextInputTokens?: number
    longContextOutputTokens?: number
    longContextRequests?: number
    cost?: number
  }

  // 每月统计
  monthly?: {
    requests: number
    tokens: number
    allTokens: number
    inputTokens: number
    outputTokens: number
    cacheCreateTokens: number
    cacheReadTokens: number
    ephemeral5mTokens?: number
    ephemeral1hTokens?: number
  }

  // 按模型统计
  byModel?: Record<
    string,
    {
      requests: number
      tokens: number
      inputTokens: number
      outputTokens: number
    }
  >

  // 最近的使用记录
  recentRecords?: UsageRecord[]
}

/**
 * 使用记录（单条）
 */
export interface UsageRecord {
  timestamp: string // ISO 8601
  model: string
  accountId: string | null
  accountType?: string
  inputTokens: number
  outputTokens: number
  cacheCreateTokens: number
  cacheReadTokens: number
  ephemeral5mTokens?: number
  ephemeral1hTokens?: number
  totalTokens: number
  cost: number
  costBreakdown?: CostBreakdown
  isLongContext?: boolean
}

/**
 * 费用明细
 */
export interface CostBreakdown {
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  ephemeral5m?: number
  ephemeral1h?: number
}

/**
 * 费用统计
 */
export interface CostStats {
  total: number
  daily: number
  weekly: number
  monthly: number
  weeklyOpus?: number // Claude Opus 周费用
}

/**
 * 账户使用统计
 */
export interface AccountUsageStats {
  accountId: string
  daily: {
    requests: number
    tokens: number
    inputTokens: number
    outputTokens: number
    cacheCreateTokens: number
    cacheReadTokens: number
    cost: number
    longContextRequests?: number
  }
  total: {
    requests: number
    tokens: number
    inputTokens: number
    outputTokens: number
    cacheCreateTokens: number
    cacheReadTokens: number
  }
  byModel?: Record<string, { requests: number; tokens: number }>
}

/**
 * 速率限制状态
 */
export interface RateLimitStatus {
  // 当前窗口统计
  currentWindowRequests: number
  currentWindowTokens: number
  currentWindowCost: number

  // 窗口时间
  windowStartTime: number | null
  windowEndTime: number | null
  windowRemainingSeconds: number | null

  // 限制配置
  rateLimitWindow: number
  rateLimitRequests: number
  rateLimitCost: number
}
