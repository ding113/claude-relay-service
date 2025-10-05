/**
 * Scheduler Service
 * 调度器核心逻辑 - 统一账户选择
 * 改进 v1: 即时重试 + 真正的负载均衡 + 无 emoji
 */

import type Redis from 'ioredis'
import logger from '@/core/logger'
import redisClient from '@/core/redis/client'
import { AccountService } from '@/modules/account/service'
import { createSessionRepository, SessionRepository } from '@/core/redis/repositories/session.repository'
import { LoadBalancer } from './load-balancer'
import type {
  Account,
  AccountPlatform,
  ScheduleRequest,
  ScheduleResult,
  ScheduleOptions,
  ModelMapping
} from '@/shared/types'

export class SchedulerService {
  private accountService: AccountService
  private sessionRepo: SessionRepository
  private loadBalancer: LoadBalancer

  constructor(redis?: Redis) {
    const client = redis || redisClient.getClient()
    this.accountService = new AccountService(redis)
    this.sessionRepo = createSessionRepository(client)
    this.loadBalancer = new LoadBalancer()
  }

  /**
   * 选择账户（核心逻辑）
   * 对应 v1: unifiedClaudeScheduler.selectAccountForApiKey
   *
   * @param request - 调度请求
   * @param options - 调度选项
   * @returns 调度结果
   */
  async selectAccount(
    request: ScheduleRequest,
    options: ScheduleOptions = {}
  ): Promise<ScheduleResult> {
    try {
      logger.debug({ request, options }, 'Selecting account')

      // 1. 检查会话映射（Sticky Session）
      if (request.sessionHash) {
        const sessionAccount = await this.tryGetSessionAccount(request.sessionHash, request.model)

        if (sessionAccount) {
          // 检查是否被排除
          if (options.excludeIds && options.excludeIds.has(sessionAccount.id)) {
            logger.debug({
              sessionHash: request.sessionHash,
              accountId: sessionAccount.id
            }, 'Session account is excluded, selecting new account')

            await this.sessionRepo.delete(request.sessionHash)
          } else {
            // 智能续期（剩余 < 14 天自动续期到 15 天）
            await this.sessionRepo.extendIfNeeded(request.sessionHash)

            logger.info({
              sessionHash: request.sessionHash,
              accountId: sessionAccount.id,
              accountName: sessionAccount.name
            }, 'Using sticky session account')

            return {
              account: sessionAccount,
              isSticky: true,
              attemptCount: 1
            }
          }
        }
      }

      // 2. 筛选可用账户
      const available = await this.filterAvailableAccounts(
        request.platform,
        request.model,
        options.excludeIds
      )

      if (available.length === 0) {
        if (request.model) {
          throw new Error(
            `No available accounts support the requested model: ${request.model}`
          )
        } else {
          throw new Error(`No available accounts for platform: ${request.platform}`)
        }
      }

      // 3. 负载均衡（优先级 + 轮询）
      const selected = this.loadBalancer.select(available)

      // 4. 创建会话映射
      if (request.sessionHash) {
        await this.sessionRepo.set(
          request.sessionHash,
          selected.id,
          selected.platform
        )

        logger.info({
          sessionHash: request.sessionHash,
          accountId: selected.id,
          accountName: selected.name
        }, 'Created new sticky session mapping')
      }

      logger.info({
        accountId: selected.id,
        accountName: selected.name,
        platform: selected.platform,
        priority: selected.priority
      }, 'Selected account')

      return {
        account: selected,
        isSticky: false,
        attemptCount: 1
      }
    } catch (error) {
      logger.error({ error, request }, 'Failed to select account')
      throw error
    }
  }

  /**
   * 尝试获取会话映射的账户
   * 对应 v1: _getSessionMapping + _isAccountAvailable
   *
   * @param sessionHash - 会话哈希
   * @param model - 请求的模型
   * @returns 账户或 null
   */
  private async tryGetSessionAccount(
    sessionHash: string,
    model: string
  ): Promise<Account | null> {
    try {
      // 获取会话映射
      const mapping = await this.sessionRepo.get(sessionHash)

      if (!mapping) {
        return null
      }

      // 获取账户详情
      const account = await this.accountService.getAccount(
        mapping.accountType as AccountPlatform,
        mapping.accountId
      )

      if (!account) {
        logger.debug({ sessionHash, accountId: mapping.accountId }, 'Mapped account not found')
        await this.sessionRepo.delete(sessionHash)
        return null
      }

      // 检查可用性
      const availability = this.accountService.checkAvailability(account)

      if (!availability.available) {
        logger.debug({
          sessionHash,
          accountId: account.id,
          reason: availability.reason
        }, 'Mapped account not available')

        await this.sessionRepo.delete(sessionHash)
        return null
      }

      // 检查模型支持
      if (!this.supportsModel(account, model)) {
        logger.debug({
          sessionHash,
          accountId: account.id,
          model
        }, 'Mapped account does not support model')

        await this.sessionRepo.delete(sessionHash)
        return null
      }

      return account
    } catch (error) {
      logger.warn({ error, sessionHash }, 'Failed to get session account')
      return null
    }
  }

  /**
   * 筛选可用账户
   * 对应 v1: _getAllAvailableAccounts
   *
   * @param platform - 平台
   * @param model - 请求的模型
   * @param excludeIds - 排除的账户 ID
   * @returns 可用账户列表（已按优先级排序）
   */
  private async filterAvailableAccounts(
    platform: AccountPlatform,
    model: string,
    excludeIds?: Set<string>
  ): Promise<Account[]> {
    try {
      // 获取所有账户
      const allAccounts = await this.accountService.listAccounts(platform)

      logger.debug({
        platform,
        totalCount: allAccounts.length,
        excludeCount: excludeIds?.size || 0
      }, 'Filtering available accounts')

      // 筛选可用账户
      const available = allAccounts.filter(account => {
        // 检查是否被排除
        if (excludeIds && excludeIds.has(account.id)) {
          logger.debug({ accountId: account.id }, 'Account excluded from selection')
          return false
        }

        // 检查可用性（复用 AccountService.checkAvailability）
        const availability = this.accountService.checkAvailability(account)

        if (!availability.available) {
          logger.debug({
            accountId: account.id,
            reason: availability.reason
          }, 'Account not available')
          return false
        }

        // 检查模型支持
        if (!this.supportsModel(account, model)) {
          logger.debug({
            accountId: account.id,
            model
          }, 'Account does not support model')
          return false
        }

        return true
      })

      // 已按优先级排序（listAccounts 返回的列表已排序）
      logger.debug({
        platform,
        model,
        availableCount: available.length
      }, 'Available accounts filtered')

      return available
    } catch (error) {
      logger.error({ error, platform, model }, 'Failed to filter available accounts')
      throw error
    }
  }

  /**
   * 检查账户是否支持请求的模型
   * 对应 v1: _isModelSupportedByAccount
   *
   * @param account - 账户
   * @param model - 请求的模型
   * @returns 是否支持
   */
  private supportsModel(account: Account, model: string): boolean {
    if (!model) {
      return true // 没有指定模型，默认支持
    }

    const mapping: ModelMapping = account.supportedModels

    // 空对象 = 支持所有模型
    if (Object.keys(mapping).length === 0) {
      return true
    }

    // 检查模型映射
    return model in mapping
  }
}
