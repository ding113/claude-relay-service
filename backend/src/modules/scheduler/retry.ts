/**
 * Retry Handler
 * 重试处理器 - 支持失败后立即切换账户
 * v2 新增：解决 v1 无重试机制的问题
 */

import type Redis from 'ioredis'
import logger from '@/core/logger'
import { SchedulerService } from './service'
import type { ScheduleRequest, ScheduleResult, ScheduleOptions } from '@/shared/types'

export class RetryHandler {
  private scheduler: SchedulerService
  private maxRetries: number

  constructor(redis?: Redis, maxRetries: number = 5) {
    this.scheduler = new SchedulerService(redis)
    this.maxRetries = maxRetries
  }

  /**
   * 带重试的账户选择
   * 对比 v1: v1 没有重试机制，错误直接返回
   *
   * @param request - 调度请求
   * @param options - 调度选项
   * @returns 调度结果
   */
  async selectWithRetry(
    request: ScheduleRequest,
    options: ScheduleOptions = {}
  ): Promise<ScheduleResult> {
    const excludeIds = options.excludeIds || new Set<string>()
    const maxRetries = Math.max(1, options.maxRetries || this.maxRetries) // 至少尝试 1 次

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug({ attempt, maxRetries, excludeCount: excludeIds.size }, 'Attempting to select account')

        // 调用调度器选择账户（传递排除列表）
        const result = await this.scheduler.selectAccount(request, {
          ...options,
          excludeIds
        })

        // 检查选中的账户是否在排除列表中
        if (excludeIds.has(result.account.id)) {
          logger.debug({
            attempt,
            accountId: result.account.id
          }, 'Selected account is excluded, retrying')
          continue
        }

        // 成功选择账户
        logger.info({
          attempt,
          accountId: result.account.id,
          accountName: result.account.name,
          isSticky: result.isSticky
        }, 'Account selected with retry')

        return {
          ...result,
          attemptCount: attempt
        }
      } catch (error) {
        lastError = error as Error

        logger.warn({
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : String(error),
          excludeCount: excludeIds.size
        }, 'Account selection failed, will retry if attempts remaining')

        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          logger.error({
            maxRetries,
            excludeCount: excludeIds.size,
            finalError: lastError.message
          }, 'All retry attempts exhausted')

          throw new Error(
            `All retry attempts exhausted (${maxRetries}): ${lastError.message}`
          )
        }
      }
    }

    // 理论上不会到达这里（循环中已处理所有情况）
    throw new Error(`Unreachable: ${lastError?.message || 'Unknown error'}`)
  }

  /**
   * 获取调度器实例（用于测试）
   */
  getScheduler(): SchedulerService {
    return this.scheduler
  }

  /**
   * 获取最大重试次数（用于测试）
   */
  getMaxRetries(): number {
    return this.maxRetries
  }
}
