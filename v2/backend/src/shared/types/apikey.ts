/**
 * API Key 数据结构定义
 * 严格对应 v1 的 apiKeyService.js
 *
 * 注意: Redis 存储的所有值都是字符串，布尔值存储为 'true' | 'false'
 */

/**
 * API Key 权限类型
 */
export type ApiKeyPermissions = 'all' | 'claude' | 'codex'

/**
 * 过期模式
 */
export type ExpirationMode = 'fixed' | 'activation'

/**
 * 激活时间单位
 */
export type ActivationUnit = 'hours' | 'days'

/**
 * API Key 数据（Redis 存储格式，所有字段都是字符串）
 * 对应 v1: apiKeyService.generateApiKey 返回的 keyData
 */
export interface ApiKeyData {
  // 基本信息
  id: string
  name: string
  description: string
  apiKey: string // SHA256 哈希值
  createdAt: string // ISO 8601
  updatedAt?: string
  lastUsedAt: string

  // 状态
  isActive: string // 'true' | 'false'
  isDeleted?: string // 'true' | 'false'
  deletedAt?: string
  deletedBy?: string
  deletedByType?: string // 'user', 'admin', 'system'
  restoredAt?: string
  restoredBy?: string
  restoredByType?: string

  // 过期管理
  expiresAt: string // ISO 8601 或空字符串
  expirationMode: string // ExpirationMode
  isActivated: string // 'true' | 'false'
  activatedAt: string // ISO 8601 或空字符串
  activationDays: string // 数字字符串
  activationUnit: string // ActivationUnit

  // 账户绑定（v2 只支持 console 和 codex）
  claudeConsoleAccountId: string
  codexAccountId: string // v2 新增
  // v1 遗留字段（v2 忽略）
  claudeAccountId?: string
  geminiAccountId?: string
  openaiAccountId?: string
  azureOpenaiAccountId?: string
  bedrockAccountId?: string

  // 权限与限制
  permissions: string // ApiKeyPermissions
  enableModelRestriction: string // 'true' | 'false'
  restrictedModels: string // JSON string array
  enableClientRestriction: string // 'true' | 'false'
  allowedClients: string // JSON string array

  // 速率限制
  tokenLimit: string // 数字字符串（v1 保留但不再使用）
  concurrencyLimit: string // 数字字符串
  rateLimitWindow: string // 分钟数
  rateLimitRequests: string // 请求数
  rateLimitCost: string // 费用限制

  // 费用限制
  dailyCostLimit: string // 数字字符串
  totalCostLimit: string // 数字字符串
  weeklyOpusCostLimit: string // 数字字符串

  // 用户关联
  userId: string
  userUsername: string
  createdBy: string // 'admin' | userId

  // 其他
  tags: string // JSON string array
  icon: string // base64 编码
}

/**
 * API Key 业务对象（解析后的格式，供业务层使用）
 */
export interface ApiKey {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt?: string
  lastUsedAt: string

  // 状态
  isActive: boolean
  isDeleted: boolean
  deletedAt?: string
  deletedBy?: string
  deletedByType?: string
  restoredAt?: string
  restoredBy?: string
  restoredByType?: string

  // 过期管理
  expiresAt?: string
  expirationMode: ExpirationMode
  isActivated: boolean
  activatedAt?: string
  activationDays: number
  activationUnit: ActivationUnit

  // 账户绑定
  claudeConsoleAccountId?: string
  codexAccountId?: string

  // 权限与限制
  permissions: ApiKeyPermissions
  enableModelRestriction: boolean
  restrictedModels: string[]
  enableClientRestriction: boolean
  allowedClients: string[]

  // 速率限制
  tokenLimit: number
  concurrencyLimit: number
  rateLimitWindow: number
  rateLimitRequests: number
  rateLimitCost: number

  // 费用限制
  dailyCostLimit: number
  totalCostLimit: number
  weeklyOpusCostLimit: number

  // 用户关联
  userId?: string
  userUsername?: string
  createdBy: string

  // 其他
  tags: string[]
  icon?: string
}

/**
 * 创建 API Key 的选项
 */
export interface CreateApiKeyOptions {
  name?: string
  description?: string
  expiresAt?: string | null
  claudeConsoleAccountId?: string | null
  codexAccountId?: string | null
  permissions?: ApiKeyPermissions
  isActive?: boolean
  concurrencyLimit?: number
  rateLimitWindow?: number | null
  rateLimitRequests?: number | null
  rateLimitCost?: number | null
  enableModelRestriction?: boolean
  restrictedModels?: string[]
  enableClientRestriction?: boolean
  allowedClients?: string[]
  dailyCostLimit?: number
  totalCostLimit?: number
  weeklyOpusCostLimit?: number
  tags?: string[]
  activationDays?: number
  activationUnit?: ActivationUnit
  expirationMode?: ExpirationMode
  icon?: string
  createdBy?: string
  userId?: string
  userUsername?: string
}

/**
 * 更新 API Key 的选项
 */
export interface UpdateApiKeyOptions {
  name?: string
  description?: string
  isActive?: boolean
  expiresAt?: string
  claudeConsoleAccountId?: string | null
  codexAccountId?: string | null
  permissions?: ApiKeyPermissions
  concurrencyLimit?: number
  rateLimitWindow?: number
  rateLimitRequests?: number
  rateLimitCost?: number
  enableModelRestriction?: boolean
  restrictedModels?: string[]
  enableClientRestriction?: boolean
  allowedClients?: string[]
  dailyCostLimit?: number
  totalCostLimit?: number
  weeklyOpusCostLimit?: number
  tags?: string[]
  activationDays?: number
  activationUnit?: ActivationUnit
  expirationMode?: ExpirationMode
  isActivated?: boolean
  activatedAt?: string
  icon?: string
  userId?: string
  userUsername?: string
  createdBy?: string
}

/**
 * API Key 验证结果
 */
export interface ApiKeyValidationResult {
  valid: boolean
  error?: string
  keyData?: ApiKey
}
