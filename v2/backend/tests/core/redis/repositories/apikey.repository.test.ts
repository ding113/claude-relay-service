/**
 * API Key Repository 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'
import { ApiKeyRepository } from '@core/redis/repositories/apikey.repository'
import type { ApiKeyData } from '@shared/types'

describe('ApiKeyRepository', () => {
  let redis: Redis
  let repository: ApiKeyRepository

  // 测试用的 API Key 数据
  const testKeyId = 'test-key-id-123'
  const testHashedKey = 'hashed-key-abc123'
  const testKeyData: ApiKeyData = {
    id: testKeyId,
    name: 'Test API Key',
    description: 'Test description',
    apiKey: testHashedKey,
    isActive: 'true',
    isDeleted: 'false',
    claudeConsoleAccountId: '',
    codexAccountId: '',
    permissions: 'all',
    enableModelRestriction: 'false',
    restrictedModels: '[]',
    enableClientRestriction: 'false',
    allowedClients: '[]',
    tokenLimit: '0',
    concurrencyLimit: '0',
    rateLimitWindow: '0',
    rateLimitRequests: '0',
    rateLimitCost: '0',
    dailyCostLimit: '0',
    totalCostLimit: '0',
    weeklyOpusCostLimit: '0',
    createdAt: new Date().toISOString(),
    lastUsedAt: '',
    expiresAt: '',
    expirationMode: 'fixed',
    isActivated: 'true',
    activatedAt: '',
    activationDays: '0',
    activationUnit: 'days',
    userId: '',
    userUsername: '',
    createdBy: 'admin',
    tags: '[]',
    icon: ''
  }

  beforeEach(() => {
    // 创建 Redis Mock 实例
    redis = new RedisMock()
    repository = new ApiKeyRepository(redis)
  })

  afterEach(async () => {
    // 清理
    await redis.flushall()
    await redis.quit()
  })

  describe('save', () => {
    it('should save API Key data to Redis', async () => {
      await repository.save(testKeyId, testKeyData)

      const saved = await redis.hgetall(`apikey:${testKeyId}`)
      expect(saved).toMatchObject({
        id: testKeyId,
        name: 'Test API Key'
      })
    })

    it('should set expiration to 1 year', async () => {
      await repository.save(testKeyId, testKeyData)

      const ttl = await redis.ttl(`apikey:${testKeyId}`)
      // Should be around 365 days (allowing some tolerance)
      expect(ttl).toBeGreaterThan(86400 * 364)
      expect(ttl).toBeLessThanOrEqual(86400 * 365)
    })

    it('should create hash mapping when hashedKey is provided', async () => {
      await repository.save(testKeyId, testKeyData, testHashedKey)

      const mappedKeyId = await redis.hget('apikey:hash_map', testHashedKey)
      expect(mappedKeyId).toBe(testKeyId)
    })

    it('should not create hash mapping when hashedKey is not provided', async () => {
      await repository.save(testKeyId, testKeyData)

      const hashMap = await redis.hgetall('apikey:hash_map')
      expect(Object.keys(hashMap)).toHaveLength(0)
    })
  })

  describe('findById', () => {
    it('should find API Key by ID', async () => {
      await repository.save(testKeyId, testKeyData)

      const found = await repository.findById(testKeyId)
      expect(found).toMatchObject({
        id: testKeyId,
        name: 'Test API Key'
      })
    })

    it('should return null when key does not exist', async () => {
      const found = await repository.findById('non-existent')
      expect(found).toBeNull()
    })

    it('should return null when key has no data', async () => {
      // Create key but don't set any fields
      await redis.set('apikey:empty', '')

      const found = await repository.findById('empty')
      expect(found).toBeNull()
    })
  })

  describe('findByHash', () => {
    beforeEach(async () => {
      await repository.save(testKeyId, testKeyData, testHashedKey)
    })

    it('should find API Key by hashed key', async () => {
      const found = await repository.findByHash(testHashedKey)

      expect(found).toMatchObject({
        id: testKeyId,
        name: 'Test API Key'
      })
    })

    it('should return null when hash mapping does not exist', async () => {
      const found = await repository.findByHash('non-existent-hash')
      expect(found).toBeNull()
    })

    it('should clean up hash mapping when key data is missing', async () => {
      // Delete the key data but keep the mapping
      await redis.del(`apikey:${testKeyId}`)

      const found = await repository.findByHash(testHashedKey)
      expect(found).toBeNull()

      // Mapping should be cleaned up
      const mapping = await redis.hget('apikey:hash_map', testHashedKey)
      expect(mapping).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all API Keys', async () => {
      const key1 = { ...testKeyData, id: 'key1' }
      const key2 = { ...testKeyData, id: 'key2' }

      await repository.save('key1', key1)
      await repository.save('key2', key2)

      const all = await repository.findAll()

      expect(all).toHaveLength(2)
      expect(all.map((k) => k.id)).toContain('key1')
      expect(all.map((k) => k.id)).toContain('key2')
    })

    it('should not include hash_map in results', async () => {
      await repository.save(testKeyId, testKeyData, testHashedKey)

      const all = await repository.findAll()

      // Should only have the test key, not the hash map
      expect(all).toHaveLength(1)
      expect(all[0].id).toBe(testKeyId)
    })

    it('should return empty array when no keys exist', async () => {
      const all = await repository.findAll()
      expect(all).toEqual([])
    })

    it('should skip keys with no data', async () => {
      // Clear any existing data first
      await redis.flushall()

      await repository.save('key1', { ...testKeyData, id: 'key1' })
      await redis.set('apikey:empty', '') // Empty key

      const all = await repository.findAll()

      expect(all).toHaveLength(1)
      expect(all[0].id).toBe('key1')
    })
  })

  describe('delete', () => {
    beforeEach(async () => {
      await repository.save(testKeyId, testKeyData, testHashedKey)
    })

    it('should delete API Key', async () => {
      await repository.delete(testKeyId)

      const exists = await redis.exists(`apikey:${testKeyId}`)
      expect(exists).toBe(0)
    })

    it('should delete hash mapping', async () => {
      await repository.delete(testKeyId)

      const mapping = await redis.hget('apikey:hash_map', testHashedKey)
      expect(mapping).toBeNull()
    })

    it('should not throw when deleting non-existent key', async () => {
      await expect(repository.delete('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('setHashMapping / deleteHashMapping', () => {
    it('should set hash mapping', async () => {
      await repository.setHashMapping('hash123', 'key123')

      const mapped = await redis.hget('apikey:hash_map', 'hash123')
      expect(mapped).toBe('key123')
    })

    it('should delete hash mapping', async () => {
      await repository.setHashMapping('hash123', 'key123')
      await repository.deleteHashMapping('hash123')

      const mapped = await redis.hget('apikey:hash_map', 'hash123')
      expect(mapped).toBeNull()
    })

    it('should not throw when deleting non-existent mapping', async () => {
      await expect(repository.deleteHashMapping('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('exists', () => {
    it('should return true when key exists', async () => {
      await repository.save(testKeyId, testKeyData)

      const exists = await repository.exists(testKeyId)
      expect(exists).toBe(true)
    })

    it('should return false when key does not exist', async () => {
      const exists = await repository.exists('non-existent')
      expect(exists).toBe(false)
    })
  })

  describe('update', () => {
    beforeEach(async () => {
      await repository.save(testKeyId, testKeyData)
    })

    it('should update API Key fields', async () => {
      await repository.update(testKeyId, {
        isActive: 'false',
        lastUsedAt: '2025-10-04T12:00:00Z'
      })

      const updated = await repository.findById(testKeyId)
      expect(updated?.isActive).toBe('false')
      expect(updated?.lastUsedAt).toBe('2025-10-04T12:00:00Z')
    })

    it('should preserve other fields when updating', async () => {
      await repository.update(testKeyId, { isActive: 'false' })

      const updated = await repository.findById(testKeyId)
      expect(updated?.name).toBe('Test API Key')
      expect(updated?.description).toBe('Test description')
    })

    it('should handle updating non-existent key', async () => {
      // ioredis-mock allows setting fields on non-existent keys
      await repository.update('non-existent', { isActive: 'false' })

      const result = await redis.hget('apikey:non-existent', 'isActive')
      expect(result).toBe('false')
    })
  })

  describe('findByIds', () => {
    beforeEach(async () => {
      await repository.save('key1', { ...testKeyData, id: 'key1', name: 'Key 1' })
      await repository.save('key2', { ...testKeyData, id: 'key2', name: 'Key 2' })
      await repository.save('key3', { ...testKeyData, id: 'key3', name: 'Key 3' })
    })

    it('should return API Keys in the same order as input', async () => {
      const results = await repository.findByIds(['key2', 'key1', 'key3'])

      expect(results).toHaveLength(3)
      expect(results[0]?.name).toBe('Key 2')
      expect(results[1]?.name).toBe('Key 1')
      expect(results[2]?.name).toBe('Key 3')
    })

    it('should return null for non-existent keys', async () => {
      const results = await repository.findByIds(['key1', 'non-existent', 'key2'])

      expect(results).toHaveLength(3)
      expect(results[0]?.name).toBe('Key 1')
      expect(results[1]).toBeNull()
      expect(results[2]?.name).toBe('Key 2')
    })

    it('should return empty array for empty input', async () => {
      const results = await repository.findByIds([])
      expect(results).toEqual([])
    })

    it('should handle duplicates in input', async () => {
      const results = await repository.findByIds(['key1', 'key1'])

      expect(results).toHaveLength(2)
      expect(results[0]?.name).toBe('Key 1')
      expect(results[1]?.name).toBe('Key 1')
    })
  })
})
