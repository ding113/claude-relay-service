/**
 * Session Repository
 * 会话映射数据访问层
 * 对应 v1 的 unifiedClaudeScheduler session mapping
 */

import type Redis from 'ioredis'
import type { SessionMappingData } from '@shared/types'
import { REDIS_KEYS } from '@shared/types'
import logger from '@core/logger'

/**
 * Session 数据访问类
 */
export class SessionRepository {
  // 默认 TTL：15 天（秒）
  private readonly DEFAULT_TTL = 15 * 24 * 60 * 60

  // 续期阈值：剩余时间少于 14 天时自动续期
  private readonly EXTEND_THRESHOLD = 14 * 24 * 60 * 60

  constructor(private readonly redis: Redis) {}

  /**
   * 设置会话映射
   * 对应 v1: _setSessionMapping
   *
   * @param sessionHash - 会话哈希
   * @param accountId - 账户 ID
   * @param accountType - 账户类型
   * @param ttl - 可选：TTL（秒），默认 15 天
   */
  async set(
    sessionHash: string,
    accountId: string,
    accountType: string,
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    const key = REDIS_KEYS.UNIFIED_CLAUDE_SESSION_MAPPING(sessionHash)

    const data: SessionMappingData = {
      accountId,
      accountType
    }

    await this.redis.hset(key, data as unknown as Record<string, string>)
    await this.redis.expire(key, ttl)

    logger.debug({ sessionHash, accountId, accountType, ttl }, 'Session mapping created')
  }

  /**
   * 获取会话映射
   * 对应 v1: _getSessionMapping
   *
   * @param sessionHash - 会话哈希
   * @returns 会话映射数据或 null
   */
  async get(sessionHash: string): Promise<SessionMappingData | null> {
    const key = REDIS_KEYS.UNIFIED_CLAUDE_SESSION_MAPPING(sessionHash)
    const data = await this.redis.hgetall(key)

    if (!data || Object.keys(data).length === 0) {
      return null
    }

    return data as unknown as SessionMappingData
  }

  /**
   * 删除会话映射
   * 对应 v1: _deleteSessionMapping
   *
   * @param sessionHash - 会话哈希
   */
  async delete(sessionHash: string): Promise<void> {
    const key = REDIS_KEYS.UNIFIED_CLAUDE_SESSION_MAPPING(sessionHash)
    await this.redis.del(key)

    logger.debug({ sessionHash }, 'Session mapping deleted')
  }

  /**
   * 检查会话映射是否存在
   *
   * @param sessionHash - 会话哈希
   * @returns 是否存在
   */
  async exists(sessionHash: string): Promise<boolean> {
    const key = REDIS_KEYS.UNIFIED_CLAUDE_SESSION_MAPPING(sessionHash)
    const exists = await this.redis.exists(key)
    return exists === 1
  }

  /**
   * 获取会话映射的剩余 TTL
   *
   * @param sessionHash - 会话哈希
   * @returns 剩余 TTL（秒），-2 表示不存在，-1 表示无过期时间
   */
  async getTTL(sessionHash: string): Promise<number> {
    const key = REDIS_KEYS.UNIFIED_CLAUDE_SESSION_MAPPING(sessionHash)
    return await this.redis.ttl(key)
  }

  /**
   * 智能续期会话映射
   * 对应 v1: _extendSessionMappingTTL
   * 剩余时间少于 14 天时自动续期到 15 天
   *
   * @param sessionHash - 会话哈希
   * @returns 是否进行了续期
   */
  async extendIfNeeded(sessionHash: string): Promise<boolean> {
    const ttl = await this.getTTL(sessionHash)

    // 不存在或无过期时间，不续期
    if (ttl < 0) {
      return false
    }

    // 剩余时间少于 14 天，续期到 15 天
    if (ttl < this.EXTEND_THRESHOLD) {
      const key = REDIS_KEYS.UNIFIED_CLAUDE_SESSION_MAPPING(sessionHash)
      await this.redis.expire(key, this.DEFAULT_TTL)

      logger.debug({
        sessionHash,
        oldTTL: ttl,
        newTTL: this.DEFAULT_TTL
      }, 'Session mapping extended')

      return true
    }

    return false
  }

  /**
   * 批量获取会话映射
   * 性能优化：使用 pipeline
   *
   * @param sessionHashes - 会话哈希数组
   * @returns 会话映射数组（保持顺序）
   */
  async getMany(sessionHashes: string[]): Promise<(SessionMappingData | null)[]> {
    if (sessionHashes.length === 0) {
      return []
    }

    const pipeline = this.redis.pipeline()

    for (const hash of sessionHashes) {
      const key = REDIS_KEYS.UNIFIED_CLAUDE_SESSION_MAPPING(hash)
      pipeline.hgetall(key)
    }

    const results = await pipeline.exec()

    if (!results) {
      return sessionHashes.map(() => null)
    }

    return results.map((result) => {
      const [err, data] = result
      if (err || !data || Object.keys(data).length === 0) {
        return null
      }
      return data as SessionMappingData
    })
  }

  /**
   * 批量删除会话映射
   *
   * @param sessionHashes - 会话哈希数组
   */
  async deleteMany(sessionHashes: string[]): Promise<void> {
    if (sessionHashes.length === 0) {
      return
    }

    const keys = sessionHashes.map((hash) => REDIS_KEYS.UNIFIED_CLAUDE_SESSION_MAPPING(hash))
    await this.redis.del(...keys)

    logger.debug({ count: sessionHashes.length }, 'Session mappings deleted')
  }
}

/**
 * 创建 Session Repository 实例
 *
 * @param redis - Redis 客户端
 * @returns Repository 实例
 */
export function createSessionRepository(redis: Redis): SessionRepository {
  return new SessionRepository(redis)
}
