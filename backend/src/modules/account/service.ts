/**
 * Account Service
 * 账户管理业务逻辑层
 * 支持 Claude Console 和 Codex 平台
 */

import { randomBytes } from 'crypto'
import type Redis from 'ioredis'
import logger from '@/core/logger'
import redisClient from '@/core/redis/client'
import { createAccountRepository, AccountRepository } from '@/core/redis/repositories/account.repository'
import type {
  Account,
  AccountData,
  AccountPlatform,
  AccountStatus,
  AccountType,
  CreateAccountOptions,
  UpdateAccountOptions,
  AccountAvailability,
  ProxyConfig,
  ModelMapping
} from '@/shared/types'

export class AccountService {
  private accountRepo: AccountRepository

  constructor(redis?: Redis) {
    const client = redis || redisClient.getClient()
    this.accountRepo = createAccountRepository(client)
  }

  /**
   * 将 AccountData (Redis 格式) 转换为 Account (业务格式)
   */
  private parseAccountData(data: AccountData): Account {
    return {
      id: data.id,
      platform: data.platform as AccountPlatform,
      name: data.name || '',
      description: data.description || '',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastUsedAt: data.lastUsedAt || '',

      // API 配置（apiKey 已在 Repository 解密）
      apiUrl: data.apiUrl || '',
      apiKey: data.apiKey,
      userAgent: data.userAgent || '',

      // 模型支持
      supportedModels: this.parseModelMapping(data.supportedModels),

      // 优先级与调度
      priority: parseInt(data.priority) || 50,
      schedulable: data.schedulable === 'true',

      // 状态
      isActive: data.isActive === 'true',
      status: (data.status as AccountStatus) || 'active',
      errorMessage: data.errorMessage || '',

      // 限流管理
      rateLimitDuration: parseInt(data.rateLimitDuration) || 0,
      rateLimitedAt: data.rateLimitedAt || undefined,
      rateLimitStatus: data.rateLimitStatus || '',
      rateLimitInfo: this.calculateRateLimitInfo(data),

      // 额度管理
      dailyQuota: parseFloat(data.dailyQuota) || 0,
      dailyUsage: parseFloat(data.dailyUsage) || 0,
      lastResetDate: data.lastResetDate || '',
      quotaResetTime: data.quotaResetTime || '00:00',
      quotaStoppedAt: data.quotaStoppedAt || undefined,

      // 账户类型
      accountType: (data.accountType as AccountType) || 'shared',

      // 代理配置
      proxy: this.parseProxyConfig(data.proxy)
    }
  }

  /**
   * 将 Account (业务格式) 转换为 AccountData (Redis 格式)
   */
  private toAccountData(account: Partial<Account> & { id: string; platform: AccountPlatform }): AccountData {
    const now = new Date().toISOString()

    return {
      id: account.id,
      platform: account.platform,
      name: account.name || '',
      description: account.description || '',
      createdAt: account.createdAt || now,
      updatedAt: now,
      lastUsedAt: account.lastUsedAt || '',

      // API 配置
      apiUrl: account.apiUrl || '',
      apiKey: account.apiKey || '', // Repository 会自动加密
      userAgent: account.userAgent || '',

      // 模型支持
      supportedModels: JSON.stringify(account.supportedModels || {}),

      // 优先级与调度
      priority: (account.priority ?? 50).toString(),
      schedulable: (account.schedulable ?? true) ? 'true' : 'false',

      // 状态
      isActive: (account.isActive ?? true) ? 'true' : 'false',
      status: account.status || 'active',
      errorMessage: account.errorMessage || '',

      // 限流管理
      rateLimitDuration: (account.rateLimitDuration ?? 0).toString(),
      rateLimitedAt: account.rateLimitedAt || '',
      rateLimitStatus: account.rateLimitStatus || '',
      rateLimitAutoStopped: '',

      // 额度管理
      dailyQuota: (account.dailyQuota ?? 0).toString(),
      dailyUsage: (account.dailyUsage ?? 0).toString(),
      lastResetDate: account.lastResetDate || '',
      quotaResetTime: account.quotaResetTime || '00:00',
      quotaStoppedAt: account.quotaStoppedAt || '',
      quotaAutoStopped: '',

      // 错误跟踪
      unauthorizedAt: '',
      unauthorizedCount: '0',
      overloadedAt: '',
      overloadStatus: '',
      blockedAt: '',

      // 账户类型
      accountType: account.accountType || 'shared',

      // 代理配置
      proxy: account.proxy ? JSON.stringify(account.proxy) : ''
    }
  }

  /**
   * 解析模型映射（JSON 字符串 -> 对象）
   */
  private parseModelMapping(json: string): ModelMapping {
    if (!json) return {}
    try {
      return JSON.parse(json)
    } catch {
      return {}
    }
  }

  /**
   * 解析代理配置（JSON 字符串 -> 对象）
   */
  private parseProxyConfig(json: string): ProxyConfig | null {
    if (!json) return null
    try {
      return JSON.parse(json) as ProxyConfig
    } catch {
      return null
    }
  }

  /**
   * 计算限流信息
   */
  private calculateRateLimitInfo(data: AccountData) {
    if (!data.rateLimitedAt || !data.rateLimitDuration) {
      return undefined
    }

    const rateLimitedAt = new Date(data.rateLimitedAt)
    const now = new Date()
    const minutesSinceRateLimit = Math.floor((now.getTime() - rateLimitedAt.getTime()) / 60000)
    const rateLimitDuration = parseInt(data.rateLimitDuration) || 0
    const minutesRemaining = Math.max(0, rateLimitDuration - minutesSinceRateLimit)

    return {
      isRateLimited: minutesRemaining > 0,
      rateLimitedAt: data.rateLimitedAt,
      minutesSinceRateLimit,
      minutesRemaining
    }
  }

  /**
   * 创建账户
   */
  async createAccount(
    platform: AccountPlatform,
    options: CreateAccountOptions = {} as CreateAccountOptions
  ): Promise<Account> {
    try {
      // 验证必填字段
      if (!options.apiUrl) {
        throw new Error('apiUrl is required')
      }
      if (!options.apiKey) {
        throw new Error('apiKey is required')
      }

      // 生成账户 ID
      const accountId = randomBytes(8).toString('hex')

      // 处理 supportedModels（兼容数组格式）
      let modelMapping: ModelMapping = {}
      if (options.supportedModels) {
        if (Array.isArray(options.supportedModels)) {
          // 数组格式：['model1', 'model2'] -> { model1: model1, model2: model2 }
          modelMapping = options.supportedModels.reduce(
            (acc, model) => {
              acc[model] = model
              return acc
            },
            {} as ModelMapping
          )
        } else {
          modelMapping = options.supportedModels
        }
      }

      const now = new Date().toISOString()

      const account: Partial<Account> & { id: string; platform: AccountPlatform } = {
        id: accountId,
        platform,
        name: options.name || `${platform} Account ${accountId.substring(0, 8)}`,
        description: options.description || '',
        createdAt: now,
        lastUsedAt: '',

        // API 配置
        apiUrl: options.apiUrl,
        apiKey: options.apiKey,
        userAgent: options.userAgent || '',

        // 模型支持
        supportedModels: modelMapping,

        // 优先级与调度
        priority: options.priority ?? 50,
        schedulable: options.schedulable ?? true,

        // 状态
        isActive: options.isActive ?? true,
        status: 'active',
        errorMessage: '',

        // 限流管理
        rateLimitDuration: options.rateLimitDuration ?? 0,
        rateLimitedAt: '',
        rateLimitStatus: '',

        // 额度管理
        dailyQuota: options.dailyQuota ?? 0,
        dailyUsage: 0,
        lastResetDate: '',
        quotaResetTime: options.quotaResetTime || '00:00',
        quotaStoppedAt: '',

        // 账户类型
        accountType: options.accountType || 'shared',

        // 代理配置
        proxy: options.proxy || null
      }

      const accountData = this.toAccountData(account)
      await this.accountRepo.save(accountId, accountData)

      logger.info({ accountId, platform, name: account.name }, 'Account created')

      // Re-fetch from repository to ensure proper format
      const savedAccountData = await this.accountRepo.findById(platform, accountId)
      if (!savedAccountData) {
        throw new Error('Failed to retrieve created account')
      }

      return this.parseAccountData(savedAccountData)
    } catch (error) {
      logger.error({ error, platform, options }, 'Failed to create account')
      throw error
    }
  }

  /**
   * 获取账户详情
   */
  async getAccount(platform: AccountPlatform, accountId: string): Promise<Account | null> {
    try {
      const accountData = await this.accountRepo.findById(platform, accountId)

      if (!accountData) {
        return null
      }

      return this.parseAccountData(accountData)
    } catch (error) {
      logger.error({ error, platform, accountId }, 'Failed to get account')
      throw error
    }
  }

  /**
   * 列出账户
   */
  async listAccounts(
    platform: AccountPlatform,
    filters: {
      isActive?: boolean
      schedulable?: boolean
      accountType?: AccountType
    } = {}
  ): Promise<Account[]> {
    try {
      const allAccounts = await this.accountRepo.findAll(platform)

      let filtered = allAccounts.map((data) => this.parseAccountData(data))

      // 过滤条件
      if (filters.isActive !== undefined) {
        filtered = filtered.filter((acc) => acc.isActive === filters.isActive)
      }

      if (filters.schedulable !== undefined) {
        filtered = filtered.filter((acc) => acc.schedulable === filters.schedulable)
      }

      if (filters.accountType) {
        filtered = filtered.filter((acc) => acc.accountType === filters.accountType)
      }

      // 按优先级排序（升序，数字小的优先）
      filtered.sort((a, b) => a.priority - b.priority)

      return filtered
    } catch (error) {
      logger.error({ error, platform, filters }, 'Failed to list accounts')
      throw error
    }
  }

  /**
   * 更新账户
   */
  async updateAccount(
    platform: AccountPlatform,
    accountId: string,
    updates: UpdateAccountOptions
  ): Promise<Account> {
    try {
      const existing = await this.accountRepo.findById(platform, accountId)

      if (!existing) {
        throw new Error('Account not found')
      }

      const updatedFields: Partial<AccountData> = {}

      // 基本字段
      if (updates.name !== undefined) updatedFields.name = updates.name
      if (updates.description !== undefined) updatedFields.description = updates.description
      if (updates.apiUrl !== undefined) updatedFields.apiUrl = updates.apiUrl
      if (updates.apiKey !== undefined) updatedFields.apiKey = updates.apiKey // Repository 会加密
      if (updates.userAgent !== undefined) updatedFields.userAgent = updates.userAgent

      // 模型映射
      if (updates.supportedModels !== undefined) {
        if (Array.isArray(updates.supportedModels)) {
          const mapping = updates.supportedModels.reduce(
            (acc, model) => {
              acc[model] = model
              return acc
            },
            {} as ModelMapping
          )
          updatedFields.supportedModels = JSON.stringify(mapping)
        } else {
          updatedFields.supportedModels = JSON.stringify(updates.supportedModels)
        }
      }

      // 优先级与调度
      if (updates.priority !== undefined) updatedFields.priority = updates.priority.toString()
      if (updates.schedulable !== undefined) updatedFields.schedulable = updates.schedulable ? 'true' : 'false'

      // 状态
      if (updates.isActive !== undefined) updatedFields.isActive = updates.isActive ? 'true' : 'false'
      if (updates.status !== undefined) updatedFields.status = updates.status
      if (updates.errorMessage !== undefined) updatedFields.errorMessage = updates.errorMessage

      // 限流
      if (updates.rateLimitDuration !== undefined) {
        updatedFields.rateLimitDuration = updates.rateLimitDuration.toString()
      }

      // 额度
      if (updates.dailyQuota !== undefined) updatedFields.dailyQuota = updates.dailyQuota.toString()
      if (updates.dailyUsage !== undefined) updatedFields.dailyUsage = updates.dailyUsage.toString()
      if (updates.lastResetDate !== undefined) updatedFields.lastResetDate = updates.lastResetDate
      if (updates.quotaStoppedAt !== undefined) updatedFields.quotaStoppedAt = updates.quotaStoppedAt

      // 代理
      if (updates.proxy !== undefined) {
        updatedFields.proxy = updates.proxy ? JSON.stringify(updates.proxy) : ''
      }

      updatedFields.updatedAt = new Date().toISOString()

      await this.accountRepo.update(platform, accountId, updatedFields)

      const updated = await this.accountRepo.findById(platform, accountId)
      logger.info({ accountId, platform, fields: Object.keys(updatedFields) }, 'Account updated')

      return this.parseAccountData(updated!)
    } catch (error) {
      logger.error({ error, platform, accountId, updates }, 'Failed to update account')
      throw error
    }
  }

  /**
   * 删除账户
   */
  async deleteAccount(platform: AccountPlatform, accountId: string): Promise<void> {
    try {
      const existing = await this.accountRepo.findById(platform, accountId)

      if (!existing) {
        throw new Error('Account not found')
      }

      await this.accountRepo.delete(platform, accountId)

      logger.info({ accountId, platform }, 'Account deleted')
    } catch (error) {
      logger.error({ error, platform, accountId }, 'Failed to delete account')
      throw error
    }
  }

  /**
   * 切换可调度状态
   */
  async toggleSchedulable(
    platform: AccountPlatform,
    accountId: string,
    schedulable: boolean
  ): Promise<Account> {
    try {
      return await this.updateAccount(platform, accountId, { schedulable })
    } catch (error) {
      logger.error({ error, platform, accountId, schedulable }, 'Failed to toggle schedulable')
      throw error
    }
  }

  /**
   * 更新账户状态
   */
  async updateAccountStatus(
    platform: AccountPlatform,
    accountId: string,
    status: AccountStatus,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.accountRepo.update(platform, accountId, {
        status,
        errorMessage: errorMessage || '',
        updatedAt: new Date().toISOString()
      })

      logger.info({ accountId, platform, status, errorMessage }, 'Account status updated')
    } catch (error) {
      logger.error({ error, platform, accountId, status }, 'Failed to update account status')
      throw error
    }
  }

  /**
   * 重置限流状态
   */
  async resetRateLimit(platform: AccountPlatform, accountId: string): Promise<Account> {
    try {
      const updates: Partial<AccountData> = {
        rateLimitedAt: '',
        rateLimitStatus: '',
        rateLimitAutoStopped: '',
        updatedAt: new Date().toISOString()
      }

      await this.accountRepo.update(platform, accountId, updates)

      const updated = await this.accountRepo.findById(platform, accountId)
      logger.info({ accountId, platform }, 'Rate limit reset')

      return this.parseAccountData(updated!)
    } catch (error) {
      logger.error({ error, platform, accountId }, 'Failed to reset rate limit')
      throw error
    }
  }

  /**
   * 更新每日使用量
   */
  async updateDailyUsage(platform: AccountPlatform, accountId: string, usage: number): Promise<void> {
    try {
      await this.accountRepo.update(platform, accountId, {
        dailyUsage: usage.toString(),
        updatedAt: new Date().toISOString()
      })

      logger.debug({ accountId, platform, usage }, 'Daily usage updated')
    } catch (error) {
      logger.error({ error, platform, accountId, usage }, 'Failed to update daily usage')
      throw error
    }
  }

  /**
   * 更新模型映射
   */
  async updateModelMapping(
    platform: AccountPlatform,
    accountId: string,
    mapping: ModelMapping
  ): Promise<Account> {
    try {
      return await this.updateAccount(platform, accountId, { supportedModels: mapping })
    } catch (error) {
      logger.error({ error, platform, accountId, mapping }, 'Failed to update model mapping')
      throw error
    }
  }

  /**
   * 更新代理配置
   */
  async updateProxyConfig(
    platform: AccountPlatform,
    accountId: string,
    proxy: ProxyConfig | null
  ): Promise<Account> {
    try {
      if (proxy && !this.validateProxyConfig(proxy)) {
        throw new Error('Invalid proxy configuration')
      }

      return await this.updateAccount(platform, accountId, { proxy })
    } catch (error) {
      logger.error({ error, platform, accountId, proxy }, 'Failed to update proxy config')
      throw error
    }
  }

  /**
   * 验证代理配置
   */
  validateProxyConfig(proxy: ProxyConfig): boolean {
    if (!proxy.protocol || !proxy.host || !proxy.port) {
      return false
    }

    if (!['http', 'https', 'socks5'].includes(proxy.protocol)) {
      return false
    }

    if (proxy.port < 1 || proxy.port > 65535) {
      return false
    }

    return true
  }

  /**
   * 检查账户可用性（为调度器准备）
   */
  checkAvailability(account: Account): AccountAvailability {
    // 检查是否激活
    if (!account.isActive) {
      return {
        available: false,
        reason: 'Account is not active',
        account
      }
    }

    // 检查是否可调度
    if (!account.schedulable) {
      return {
        available: false,
        reason: 'Account is not schedulable',
        account
      }
    }

    // 检查限流状态
    if (account.rateLimitInfo && account.rateLimitInfo.isRateLimited) {
      return {
        available: false,
        reason: `Rate limited (${account.rateLimitInfo.minutesRemaining} minutes remaining)`,
        account
      }
    }

    // 检查额度
    if (account.dailyQuota > 0 && account.dailyUsage >= account.dailyQuota) {
      return {
        available: false,
        reason: 'Daily quota exceeded',
        account
      }
    }

    // 检查账户状态
    if (account.status !== 'active') {
      return {
        available: false,
        reason: `Account status is ${account.status}`,
        account
      }
    }

    return {
      available: true,
      account
    }
  }
}
