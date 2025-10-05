/**
 * Account Repository
 * 数据访问层，对应 v1 的 claudeConsoleAccountService
 * 支持 Claude Console 和 Codex 账户
 */

import type Redis from 'ioredis'
import type { AccountData, AccountPlatform } from '@shared/types'
import { REDIS_KEYS, REDIS_KEY_PATTERNS } from '@shared/types'
import logger from '@core/logger'
import { encryptSensitiveData, decryptSensitiveData } from '../utils/encryption'

/**
 * Account 数据访问类
 */
export class AccountRepository {
  constructor(private readonly redis: Redis) {}

  /**
   * 保存账户数据
   * 对应 v1: claudeConsoleAccountService.createAccount
   *
   * @param accountId - 账户 ID
   * @param accountData - 账户数据（Redis 格式）
   */
  async save(accountId: string, accountData: AccountData): Promise<void> {
    const platform = accountData.platform as AccountPlatform
    const key = this.getAccountKey(platform, accountId)

    // 加密敏感字段（apiKey）
    const dataToSave = {
      ...accountData,
      apiKey: encryptSensitiveData(accountData.apiKey)
    }

    await this.redis.hset(key, dataToSave as Record<string, string>)

    // 如果是共享账户，添加到共享账户集合
    if (accountData.accountType === 'shared') {
      const sharedKey = this.getSharedAccountsKey(platform)
      await this.redis.sadd(sharedKey, accountId)
    }

    logger.debug({ accountId, platform }, 'Account saved')
  }

  /**
   * 通过 ID 查找账户
   * 对应 v1: claudeConsoleAccountService.getAccount
   *
   * @param platform - 平台类型
   * @param accountId - 账户 ID
   * @returns 账户数据或 null
   */
  async findById(platform: AccountPlatform, accountId: string): Promise<AccountData | null> {
    const key = this.getAccountKey(platform, accountId)
    const data = await this.redis.hgetall(key)

    if (!data || Object.keys(data).length === 0) {
      return null
    }

    // 解密敏感字段
    const decryptedData = {
      ...data,
      apiKey: decryptSensitiveData(data.apiKey || '')
    }

    return decryptedData as AccountData
  }

  /**
   * 获取所有账户
   * 对应 v1: claudeConsoleAccountService.getAllAccounts
   *
   * @param platform - 平台类型
   * @returns 账户数据数组
   */
  async findAll(platform: AccountPlatform): Promise<AccountData[]> {
    const pattern = this.getAccountPattern(platform)
    const keys = await this.redis.keys(pattern)
    const accounts: AccountData[] = []

    for (const key of keys) {
      const accountData = await this.redis.hgetall(key)
      if (accountData && Object.keys(accountData).length > 0) {
        // 解密敏感字段
        const decryptedData = {
          ...accountData,
          apiKey: decryptSensitiveData(accountData.apiKey || '')
        }
        accounts.push(decryptedData as AccountData)
      }
    }

    return accounts
  }

  /**
   * 删除账户
   * 对应 v1: claudeConsoleAccountService.deleteAccount
   *
   * @param platform - 平台类型
   * @param accountId - 账户 ID
   */
  async delete(platform: AccountPlatform, accountId: string): Promise<void> {
    const key = this.getAccountKey(platform, accountId)

    // 获取账户数据以确定是否为共享账户
    const accountData = await this.redis.hgetall(key)

    // 删除账户数据
    await this.redis.del(key)

    // 如果是共享账户，从共享账户集合中移除
    if (accountData?.accountType === 'shared') {
      const sharedKey = this.getSharedAccountsKey(platform)
      await this.redis.srem(sharedKey, accountId)
    }

    logger.debug({ accountId, platform }, 'Account deleted')
  }

  /**
   * 更新账户字段
   *
   * @param platform - 平台类型
   * @param accountId - 账户 ID
   * @param updates - 要更新的字段
   */
  async update(platform: AccountPlatform, accountId: string, updates: Partial<AccountData>): Promise<void> {
    const key = this.getAccountKey(platform, accountId)

    // 如果更新了 apiKey，需要加密
    const dataToUpdate = { ...updates }
    if (dataToUpdate.apiKey) {
      dataToUpdate.apiKey = encryptSensitiveData(dataToUpdate.apiKey)
    }

    await this.redis.hset(key, dataToUpdate as Record<string, string>)

    // 如果更新了 accountType，需要同步共享账户集合
    if (updates.accountType !== undefined) {
      const sharedKey = this.getSharedAccountsKey(platform)
      if (updates.accountType === 'shared') {
        await this.redis.sadd(sharedKey, accountId)
      } else {
        await this.redis.srem(sharedKey, accountId)
      }
    }

    logger.debug({ accountId, platform, fields: Object.keys(updates) }, 'Account updated')
  }

  /**
   * 检查账户是否存在
   *
   * @param platform - 平台类型
   * @param accountId - 账户 ID
   * @returns 是否存在
   */
  async exists(platform: AccountPlatform, accountId: string): Promise<boolean> {
    const key = this.getAccountKey(platform, accountId)
    const exists = await this.redis.exists(key)
    return exists === 1
  }

  /**
   * 获取共享账户 ID 列表
   *
   * @param platform - 平台类型
   * @returns 共享账户 ID 数组
   */
  async getSharedAccountIds(platform: AccountPlatform): Promise<string[]> {
    const key = this.getSharedAccountsKey(platform)
    return await this.redis.smembers(key)
  }

  /**
   * 批量获取账户
   * 性能优化：使用 pipeline
   *
   * @param platform - 平台类型
   * @param accountIds - 账户 ID 数组
   * @returns 账户数据数组（保持顺序）
   */
  async findByIds(platform: AccountPlatform, accountIds: string[]): Promise<(AccountData | null)[]> {
    if (accountIds.length === 0) {
      return []
    }

    const pipeline = this.redis.pipeline()

    for (const accountId of accountIds) {
      const key = this.getAccountKey(platform, accountId)
      pipeline.hgetall(key)
    }

    const results = await pipeline.exec()

    if (!results) {
      return accountIds.map(() => null)
    }

    return results.map((result) => {
      const [err, data] = result
      if (err || !data || Object.keys(data).length === 0) {
        return null
      }
      // 解密敏感字段
      const decryptedData = {
        ...data,
        apiKey: decryptSensitiveData((data as Record<string, string>).apiKey || '')
      }
      return decryptedData as AccountData
    })
  }

  /**
   * 获取账户 Redis Key
   *
   * @param platform - 平台类型
   * @param accountId - 账户 ID
   * @returns Redis Key
   */
  private getAccountKey(platform: AccountPlatform, accountId: string): string {
    switch (platform) {
      case 'claude-console':
        return REDIS_KEYS.CLAUDE_CONSOLE_ACCOUNT(accountId)
      case 'codex':
        return REDIS_KEYS.CODEX_ACCOUNT(accountId)
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  /**
   * 获取共享账户集合 Key
   *
   * @param platform - 平台类型
   * @returns Redis Key
   */
  private getSharedAccountsKey(platform: AccountPlatform): string {
    switch (platform) {
      case 'claude-console':
        return REDIS_KEYS.SHARED_CLAUDE_CONSOLE_ACCOUNTS
      case 'codex':
        return REDIS_KEYS.SHARED_CODEX_ACCOUNTS
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  /**
   * 获取账户 Key 模式（用于查询）
   *
   * @param platform - 平台类型
   * @returns Redis Key Pattern
   */
  private getAccountPattern(platform: AccountPlatform): string {
    switch (platform) {
      case 'claude-console':
        return REDIS_KEY_PATTERNS.ALL_CLAUDE_CONSOLE_ACCOUNTS
      case 'codex':
        return REDIS_KEY_PATTERNS.ALL_CODEX_ACCOUNTS
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }
}

/**
 * 创建 Account Repository 实例
 *
 * @param redis - Redis 客户端
 * @returns Repository 实例
 */
export function createAccountRepository(redis: Redis): AccountRepository {
  return new AccountRepository(redis)
}
