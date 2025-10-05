/**
 * Usage Repository
 * 使用统计数据访问层
 * 对应 v1 的 redis.js 中的 incrementTokenUsage 等方法
 */

import type Redis from 'ioredis'
import type { UsageData, UsageStats } from '@shared/types'
import { REDIS_KEYS } from '@shared/types'
import logger from '@core/logger'
import {
  getDateStringInTimezone,
  getMonthStringInTimezone,
  getHourStringInTimezone
} from '../utils/timezone'

/**
 * Usage 数据访问类
 */
export class UsageRepository {
  constructor(private readonly redis: Redis) {}

  /**
   * 增加 Token 使用量
   * 对应 v1: redis.incrementTokenUsage
   *
   * @param keyId - API Key ID
   * @param usage - Usage 数据
   */
  async incrementUsage(keyId: string, usage: UsageData): Promise<void> {
    const now = new Date()
    const today = getDateStringInTimezone(now)
    const currentMonth = getMonthStringInTimezone(now)
    const currentHour = getHourStringInTimezone(now)

    // 计算总 token 数
    const coreTokens = usage.inputTokens + usage.outputTokens
    const totalTokens = coreTokens + usage.cacheCreateTokens + usage.cacheReadTokens

    const pipeline = this.redis.pipeline()

    // 总计统计
    const usageKey = REDIS_KEYS.USAGE(keyId)
    pipeline.hincrby(usageKey, 'totalTokens', coreTokens)
    pipeline.hincrby(usageKey, 'totalInputTokens', usage.inputTokens)
    pipeline.hincrby(usageKey, 'totalOutputTokens', usage.outputTokens)
    pipeline.hincrby(usageKey, 'totalCacheCreateTokens', usage.cacheCreateTokens)
    pipeline.hincrby(usageKey, 'totalCacheReadTokens', usage.cacheReadTokens)
    pipeline.hincrby(usageKey, 'totalAllTokens', totalTokens)
    pipeline.hincrby(usageKey, 'totalRequests', 1)

    // 可选字段
    if (usage.ephemeral5mTokens) {
      pipeline.hincrby(usageKey, 'totalEphemeral5mTokens', usage.ephemeral5mTokens)
    }
    if (usage.ephemeral1hTokens) {
      pipeline.hincrby(usageKey, 'totalEphemeral1hTokens', usage.ephemeral1hTokens)
    }
    if (usage.isLongContextRequest) {
      pipeline.hincrby(usageKey, 'totalLongContextInputTokens', usage.inputTokens)
      pipeline.hincrby(usageKey, 'totalLongContextOutputTokens', usage.outputTokens)
      pipeline.hincrby(usageKey, 'totalLongContextRequests', 1)
    }

    // 每日统计
    const dailyKey = REDIS_KEYS.USAGE_DAILY(keyId, today)
    pipeline.hincrby(dailyKey, 'tokens', coreTokens)
    pipeline.hincrby(dailyKey, 'inputTokens', usage.inputTokens)
    pipeline.hincrby(dailyKey, 'outputTokens', usage.outputTokens)
    pipeline.hincrby(dailyKey, 'cacheCreateTokens', usage.cacheCreateTokens)
    pipeline.hincrby(dailyKey, 'cacheReadTokens', usage.cacheReadTokens)
    pipeline.hincrby(dailyKey, 'allTokens', totalTokens)
    pipeline.hincrby(dailyKey, 'requests', 1)
    pipeline.expire(dailyKey, 90 * 24 * 60 * 60) // 90 天过期

    // 每月统计
    const monthlyKey = REDIS_KEYS.USAGE_MONTHLY(keyId, currentMonth)
    pipeline.hincrby(monthlyKey, 'tokens', coreTokens)
    pipeline.hincrby(monthlyKey, 'inputTokens', usage.inputTokens)
    pipeline.hincrby(monthlyKey, 'outputTokens', usage.outputTokens)
    pipeline.hincrby(monthlyKey, 'cacheCreateTokens', usage.cacheCreateTokens)
    pipeline.hincrby(monthlyKey, 'cacheReadTokens', usage.cacheReadTokens)
    pipeline.hincrby(monthlyKey, 'allTokens', totalTokens)
    pipeline.hincrby(monthlyKey, 'requests', 1)
    pipeline.expire(monthlyKey, 365 * 24 * 60 * 60) // 365 天过期

    // 每小时统计
    const hourlyKey = REDIS_KEYS.USAGE_HOURLY(keyId, currentHour)
    pipeline.hincrby(hourlyKey, 'tokens', coreTokens)
    pipeline.hincrby(hourlyKey, 'inputTokens', usage.inputTokens)
    pipeline.hincrby(hourlyKey, 'outputTokens', usage.outputTokens)
    pipeline.hincrby(hourlyKey, 'requests', 1)
    pipeline.expire(hourlyKey, 7 * 24 * 60 * 60) // 7 天过期

    await pipeline.exec()

    logger.debug({ keyId, model: usage.model, tokens: totalTokens }, 'Usage incremented')
  }

  /**
   * 获取使用统计
   *
   * @param keyId - API Key ID
   * @returns 使用统计数据
   */
  async getStats(keyId: string): Promise<UsageStats> {
    const now = new Date()
    const today = getDateStringInTimezone(now)
    const currentMonth = getMonthStringInTimezone(now)

    const pipeline = this.redis.pipeline()

    // 总计
    pipeline.hgetall(REDIS_KEYS.USAGE(keyId))
    // 每日
    pipeline.hgetall(REDIS_KEYS.USAGE_DAILY(keyId, today))
    // 每月
    pipeline.hgetall(REDIS_KEYS.USAGE_MONTHLY(keyId, currentMonth))

    const results = await pipeline.exec()

    if (!results) {
      return this.emptyStats()
    }

    const [, totalData] = results[0]
    const [, dailyData] = results[1]
    const [, monthlyData] = results[2]

    return {
      total: this.parseUsageData(totalData as Record<string, string>),
      daily: this.parseUsageData(dailyData as Record<string, string>),
      monthly: this.parseUsageData(monthlyData as Record<string, string>)
    }
  }

  /**
   * 增加费用统计
   *
   * @param keyId - API Key ID
   * @param cost - 费用（美元）
   */
  async incrementCost(keyId: string, cost: number): Promise<void> {
    const now = new Date()
    const today = getDateStringInTimezone(now)

    const dailyKey = REDIS_KEYS.USAGE_DAILY(keyId, today)
    await this.redis.hincrbyfloat(dailyKey, 'cost', cost)
    await this.redis.expire(dailyKey, 90 * 24 * 60 * 60)

    logger.debug({ keyId, cost }, 'Cost incremented')
  }

  /**
   * 清除统计数据
   *
   * @param keyId - API Key ID
   */
  async clear(keyId: string): Promise<void> {
    const keys = await this.redis.keys(`usage:*${keyId}*`)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }

    logger.debug({ keyId, keysDeleted: keys.length }, 'Usage stats cleared')
  }

  /**
   * 解析 Usage 数据
   */
  private parseUsageData(data: Record<string, string>): {
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
  } {
    return {
      requests: parseInt(data.requests || data.totalRequests || '0') || 0,
      tokens: parseInt(data.tokens || data.totalTokens || '0') || 0,
      allTokens: parseInt(data.allTokens || data.totalAllTokens || '0') || 0,
      inputTokens: parseInt(data.inputTokens || data.totalInputTokens || '0') || 0,
      outputTokens: parseInt(data.outputTokens || data.totalOutputTokens || '0') || 0,
      cacheCreateTokens: parseInt(data.cacheCreateTokens || data.totalCacheCreateTokens || '0') || 0,
      cacheReadTokens: parseInt(data.cacheReadTokens || data.totalCacheReadTokens || '0') || 0,
      ephemeral5mTokens: data.ephemeral5mTokens || data.totalEphemeral5mTokens
        ? parseInt(data.ephemeral5mTokens || data.totalEphemeral5mTokens)
        : undefined,
      ephemeral1hTokens: data.ephemeral1hTokens || data.totalEphemeral1hTokens
        ? parseInt(data.ephemeral1hTokens || data.totalEphemeral1hTokens)
        : undefined,
      longContextInputTokens: data.longContextInputTokens || data.totalLongContextInputTokens
        ? parseInt(data.longContextInputTokens || data.totalLongContextInputTokens)
        : undefined,
      longContextOutputTokens: data.longContextOutputTokens || data.totalLongContextOutputTokens
        ? parseInt(data.longContextOutputTokens || data.totalLongContextOutputTokens)
        : undefined,
      longContextRequests: data.longContextRequests || data.totalLongContextRequests
        ? parseInt(data.longContextRequests || data.totalLongContextRequests)
        : undefined,
      cost: data.cost ? parseFloat(data.cost) : undefined
    }
  }

  /**
   * 空统计数据
   */
  private emptyStats(): UsageStats {
    const empty = {
      requests: 0,
      tokens: 0,
      allTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreateTokens: 0,
      cacheReadTokens: 0
    }

    return {
      total: empty,
      daily: empty,
      monthly: empty
    }
  }
}

/**
 * 创建 Usage Repository 实例
 *
 * @param redis - Redis 客户端
 * @returns Repository 实例
 */
export function createUsageRepository(redis: Redis): UsageRepository {
  return new UsageRepository(redis)
}
