/**
 * 账户数据结构定义
 * 对应 v1 的 claudeConsoleAccountService.js
 * v2 支持 Claude Console 和 Codex 账户
 */

/**
 * 平台类型
 */
export type AccountPlatform = 'claude-console' | 'codex'

/**
 * 账户类型
 */
export type AccountType = 'dedicated' | 'shared'

/**
 * 账户状态
 */
export type AccountStatus =
  | 'active'
  | 'error'
  | 'rate_limited'
  | 'unauthorized'
  | 'overloaded'
  | 'blocked'
  | 'quota_exceeded'
  | 'temp_error'

/**
 * 代理配置
 */
export interface ProxyConfig {
  protocol: 'http' | 'https' | 'socks5'
  host: string
  port: number
  auth?: {
    username: string
    password: string
  }
}

/**
 * 模型映射表
 * 键: 请求的模型名
 * 值: 实际使用的模型名
 * 空对象表示支持所有模型
 */
export type ModelMapping = Record<string, string>

/**
 * 账户数据（Redis 存储格式，字符串）
 * 对应 v1: claudeConsoleAccountService.createAccount
 */
export interface AccountData {
  // 基本信息
  id: string
  platform: string // AccountPlatform
  name: string
  description: string
  createdAt: string // ISO 8601
  updatedAt?: string
  lastUsedAt: string

  // API 配置
  apiUrl: string // 明文存储
  apiKey: string // AES-256-CBC 加密存储
  userAgent: string

  // 模型支持
  supportedModels: string // JSON: ModelMapping

  // 优先级与调度
  priority: string // 数字字符串 (1-100)
  schedulable: string // 'true' | 'false'

  // 状态
  isActive: string // 'true' | 'false'
  status: string // AccountStatus
  errorMessage: string

  // 限流管理
  rateLimitDuration: string // 分钟数
  rateLimitedAt: string // ISO 8601 或空字符串
  rateLimitStatus: string // 'limited' | ''
  rateLimitAutoStopped: string // 'true' | ''

  // 额度管理
  dailyQuota: string // 美元
  dailyUsage: string // 美元（v1 保留但 v2 从统计计算）
  lastResetDate: string // YYYY-MM-DD
  quotaResetTime: string // HH:mm
  quotaStoppedAt: string // ISO 8601 或空字符串
  quotaAutoStopped: string // 'true' | ''

  // 错误跟踪
  unauthorizedAt: string
  unauthorizedCount: string
  overloadedAt: string
  overloadStatus: string // 'overloaded' | ''
  blockedAt: string

  // 账户类型
  accountType: string // AccountType

  // 代理配置
  proxy: string // JSON: ProxyConfig | ''
}

/**
 * 账户业务对象（解析后的格式）
 */
export interface Account {
  id: string
  platform: AccountPlatform
  name: string
  description: string
  createdAt: string
  updatedAt?: string
  lastUsedAt: string

  // API 配置
  apiUrl: string
  apiKey: string // 解密后的明文
  userAgent: string

  // 模型支持
  supportedModels: ModelMapping

  // 优先级与调度
  priority: number
  schedulable: boolean

  // 状态
  isActive: boolean
  status: AccountStatus
  errorMessage: string

  // 限流管理
  rateLimitDuration: number
  rateLimitedAt?: string
  rateLimitStatus: string
  rateLimitInfo?: RateLimitInfo

  // 额度管理
  dailyQuota: number
  dailyUsage: number
  lastResetDate: string
  quotaResetTime: string
  quotaStoppedAt?: string

  // 账户类型
  accountType: AccountType

  // 代理配置
  proxy: ProxyConfig | null
}

/**
 * 限流信息
 */
export interface RateLimitInfo {
  isRateLimited: boolean
  rateLimitedAt: string | null
  minutesSinceRateLimit: number
  minutesRemaining: number
}

/**
 * 创建账户选项
 */
export interface CreateAccountOptions {
  name?: string
  description?: string
  apiUrl: string
  apiKey: string
  priority?: number
  supportedModels?: ModelMapping | string[] // 兼容旧格式数组
  userAgent?: string
  rateLimitDuration?: number
  proxy?: ProxyConfig | null
  isActive?: boolean
  accountType?: AccountType
  schedulable?: boolean
  dailyQuota?: number
  quotaResetTime?: string
}

/**
 * 更新账户选项
 */
export interface UpdateAccountOptions {
  name?: string
  description?: string
  apiUrl?: string
  apiKey?: string
  priority?: number
  supportedModels?: ModelMapping | string[]
  userAgent?: string
  rateLimitDuration?: number
  proxy?: ProxyConfig | null
  isActive?: boolean
  schedulable?: boolean
  dailyQuota?: number
  quotaResetTime?: string
  dailyUsage?: number
  lastResetDate?: string
  quotaStoppedAt?: string
  status?: AccountStatus
  errorMessage?: string
}

/**
 * 账户可用性检查结果
 */
export interface AccountAvailability {
  available: boolean
  reason?: string
  account?: Account
}
