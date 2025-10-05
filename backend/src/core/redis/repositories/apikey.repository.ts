/**
 * API Key Repository
 * 数据访问层，对应 v1 的 apiKeyService 和 redis.js
 * 只负责数据存储和检索，不包含业务逻辑
 */

import type Redis from 'ioredis'
import type { ApiKeyData } from '@shared/types'
import { REDIS_KEYS, REDIS_KEY_PATTERNS } from '@shared/types'
import logger from '@core/logger'

/**
 * API Key 数据访问类
 */
export class ApiKeyRepository {
  constructor(private readonly redis: Redis) {}

  /**
   * 保存 API Key 数据
   * 对应 v1: redis.setApiKey
   *
   * @param keyId - API Key ID
   * @param keyData - API Key 数据（Redis 格式，所有字段为字符串）
   * @param hashedKey - 可选：哈希值（用于建立哈希映射）
   */
  async save(keyId: string, keyData: ApiKeyData, hashedKey?: string): Promise<void> {
    const key = REDIS_KEYS.API_KEY(keyId)

    // 保存 API Key 数据
    await this.redis.hset(key, keyData as unknown as Record<string, string>)
    await this.redis.expire(key, 86400 * 365) // 1 年过期

    // 建立哈希映射（如果提供了 hashedKey）
    if (hashedKey) {
      await this.setHashMapping(hashedKey, keyId)
    }

    logger.debug({ keyId, hasHashMapping: !!hashedKey }, 'API Key saved')
  }

  /**
   * 通过 ID 查找 API Key
   * 对应 v1: redis.getApiKey
   *
   * @param keyId - API Key ID
   * @returns API Key 数据或 null
   */
  async findById(keyId: string): Promise<ApiKeyData | null> {
    const key = REDIS_KEYS.API_KEY(keyId)
    const data = await this.redis.hgetall(key)

    if (!data || Object.keys(data).length === 0) {
      return null
    }

    return { id: keyId, ...data } as unknown as ApiKeyData
  }

  /**
   * 通过哈希值查找 API Key（性能优化）
   * 对应 v1: redis.findApiKeyByHash
   *
   * @param hashedKey - API Key 哈希值
   * @returns API Key 数据或 null
   */
  async findByHash(hashedKey: string): Promise<ApiKeyData | null> {
    // 通过哈希映射表查找 keyId
    const keyId = await this.redis.hget(REDIS_KEYS.API_KEY_HASH_MAP, hashedKey)

    if (!keyId) {
      return null
    }

    // 获取 API Key 数据
    const keyData = await this.findById(keyId)

    if (!keyData) {
      // 数据不存在，清理映射表
      await this.deleteHashMapping(hashedKey)
      return null
    }

    // keyData already includes id from findById
    return keyData
  }

  /**
   * 获取所有 API Key
   * 对应 v1: redis.getAllApiKeys
   *
   * @returns API Key 数据数组
   */
  async findAll(): Promise<ApiKeyData[]> {
    const keys = await this.redis.keys(REDIS_KEY_PATTERNS.ALL_API_KEYS)
    const apiKeys: ApiKeyData[] = []

    for (const key of keys) {
      // 过滤掉 hash_map，它不是真正的 API Key
      if (key === REDIS_KEYS.API_KEY_HASH_MAP) {
        continue
      }

      const keyData = await this.redis.hgetall(key)
      if (keyData && Object.keys(keyData).length > 0) {
        const keyId = key.replace('apikey:', '')
        apiKeys.push({ id: keyId, ...keyData } as ApiKeyData)
      }
    }

    return apiKeys
  }

  /**
   * 删除 API Key
   * 对应 v1: redis.deleteApiKey
   *
   * @param keyId - API Key ID
   */
  async delete(keyId: string): Promise<void> {
    const key = REDIS_KEYS.API_KEY(keyId)

    // 获取要删除的 API Key 数据，以便从映射表中移除
    const keyData = await this.redis.hgetall(key)
    if (keyData && keyData.apiKey) {
      await this.deleteHashMapping(keyData.apiKey)
    }

    // 删除 API Key 数据
    await this.redis.del(key)

    logger.debug({ keyId }, 'API Key deleted')
  }

  /**
   * 设置哈希映射（hashedKey -> keyId）
   * 用于快速查找
   *
   * @param hashedKey - API Key 哈希值
   * @param keyId - API Key ID
   */
  async setHashMapping(hashedKey: string, keyId: string): Promise<void> {
    await this.redis.hset(REDIS_KEYS.API_KEY_HASH_MAP, hashedKey, keyId)
  }

  /**
   * 删除哈希映射
   *
   * @param hashedKey - API Key 哈希值
   */
  async deleteHashMapping(hashedKey: string): Promise<void> {
    await this.redis.hdel(REDIS_KEYS.API_KEY_HASH_MAP, hashedKey)
  }

  /**
   * 检查 API Key 是否存在
   *
   * @param keyId - API Key ID
   * @returns 是否存在
   */
  async exists(keyId: string): Promise<boolean> {
    const key = REDIS_KEYS.API_KEY(keyId)
    const exists = await this.redis.exists(key)
    return exists === 1
  }

  /**
   * 更新 API Key 字段
   * 用于更新部分字段，如 lastUsedAt, isActive 等
   *
   * @param keyId - API Key ID
   * @param updates - 要更新的字段（Redis 格式，字符串值）
   */
  async update(keyId: string, updates: Partial<ApiKeyData>): Promise<void> {
    const key = REDIS_KEYS.API_KEY(keyId)
    await this.redis.hset(key, updates as unknown as Record<string, string>)

    logger.debug({ keyId, fields: Object.keys(updates) }, 'API Key updated')
  }

  /**
   * 批量获取 API Key
   * 性能优化：使用 pipeline
   *
   * @param keyIds - API Key ID 数组
   * @returns API Key 数据数组（保持顺序）
   */
  async findByIds(keyIds: string[]): Promise<(ApiKeyData | null)[]> {
    if (keyIds.length === 0) {
      return []
    }

    const pipeline = this.redis.pipeline()

    for (const keyId of keyIds) {
      pipeline.hgetall(REDIS_KEYS.API_KEY(keyId))
    }

    const results = await pipeline.exec()

    if (!results) {
      return keyIds.map(() => null)
    }

    return results.map((result, index) => {
      const [err, data] = result
      if (err || !data || Object.keys(data).length === 0) {
        return null
      }
      return { id: keyIds[index], ...data } as ApiKeyData
    })
  }
}

/**
 * 创建 API Key Repository 实例
 *
 * @param redis - Redis 客户端
 * @returns Repository 实例
 */
export function createApiKeyRepository(redis: Redis): ApiKeyRepository {
  return new ApiKeyRepository(redis)
}
