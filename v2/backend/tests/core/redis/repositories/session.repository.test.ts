/**
 * Session Repository 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'
import { SessionRepository } from '@core/redis/repositories/session.repository'
import type { SessionMappingData } from '@shared/types'

describe('SessionRepository', () => {
  let redis: Redis
  let repository: SessionRepository

  const testSessionHash = 'session-hash-123'
  const testMapping: SessionMappingData = {
    accountId: 'acc-123',
    accountType: 'claude-console'
  }

  beforeEach(() => {
    redis = new RedisMock()
    repository = new SessionRepository(redis)
  })

  afterEach(async () => {
    await redis.flushall()
    await redis.quit()
  })

  describe('set', () => {
    it('should set session mapping with default TTL (15 days)', async () => {
      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType)

      const saved = await redis.hgetall(`unified_claude_session_mapping:${testSessionHash}`)
      expect(saved).toEqual(testMapping)

      const ttl = await redis.ttl(`unified_claude_session_mapping:${testSessionHash}`)
      // 15 days = 1296000 seconds
      expect(ttl).toBeGreaterThan(1295900)
      expect(ttl).toBeLessThanOrEqual(1296000)
    })

    it('should set session mapping with custom TTL', async () => {
      const customTTL = 3600 // 1 hour

      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType, customTTL)

      const ttl = await redis.ttl(`unified_claude_session_mapping:${testSessionHash}`)
      expect(ttl).toBeGreaterThan(3595)
      expect(ttl).toBeLessThanOrEqual(3600)
    })
  })

  describe('get', () => {
    beforeEach(async () => {
      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType)
    })

    it('should get session mapping', async () => {
      const result = await repository.get(testSessionHash)

      expect(result).toEqual(testMapping)
    })

    it('should return null when mapping does not exist', async () => {
      const result = await repository.get('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    beforeEach(async () => {
      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType)
    })

    it('should delete session mapping', async () => {
      await repository.delete(testSessionHash)

      const exists = await redis.exists(`unified_claude_session_mapping:${testSessionHash}`)
      expect(exists).toBe(0)
    })

    it('should not throw when deleting non-existent mapping', async () => {
      await expect(repository.delete('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('exists', () => {
    it('should return true when mapping exists', async () => {
      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType)

      const exists = await repository.exists(testSessionHash)
      expect(exists).toBe(true)
    })

    it('should return false when mapping does not exist', async () => {
      const exists = await repository.exists('non-existent')
      expect(exists).toBe(false)
    })
  })

  describe('getTTL', () => {
    it('should return TTL for existing mapping', async () => {
      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType)

      const ttl = await repository.getTTL(testSessionHash)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(15 * 24 * 60 * 60)
    })

    it('should return -2 for non-existent mapping', async () => {
      const ttl = await repository.getTTL('non-existent')
      expect(ttl).toBe(-2)
    })
  })

  describe('extendIfNeeded', () => {
    it('should extend TTL when less than 14 days remaining', async () => {
      const shortTTL = 10 * 24 * 60 * 60 // 10 days
      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType, shortTTL)

      const extended = await repository.extendIfNeeded(testSessionHash)
      expect(extended).toBe(true)

      const newTTL = await repository.getTTL(testSessionHash)
      // Should be extended to 15 days
      expect(newTTL).toBeGreaterThan(14.9 * 24 * 60 * 60)
      expect(newTTL).toBeLessThanOrEqual(15 * 24 * 60 * 60)
    })

    it('should not extend TTL when more than 14 days remaining', async () => {
      const longTTL = 15 * 24 * 60 * 60 // 15 days
      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType, longTTL)

      const extended = await repository.extendIfNeeded(testSessionHash)
      expect(extended).toBe(false)
    })

    it('should not extend when mapping does not exist', async () => {
      const extended = await repository.extendIfNeeded('non-existent')
      expect(extended).toBe(false)
    })
  })

  describe('getMany', () => {
    beforeEach(async () => {
      await repository.set('hash1', 'acc1', 'claude-console')
      await repository.set('hash2', 'acc2', 'codex')
      await repository.set('hash3', 'acc3', 'claude-console')
    })

    it('should return mappings in the same order as input', async () => {
      const results = await repository.getMany(['hash2', 'hash1', 'hash3'])

      expect(results).toHaveLength(3)
      expect(results[0]?.accountId).toBe('acc2')
      expect(results[1]?.accountId).toBe('acc1')
      expect(results[2]?.accountId).toBe('acc3')
    })

    it('should return null for non-existent mappings', async () => {
      const results = await repository.getMany(['hash1', 'non-existent', 'hash2'])

      expect(results).toHaveLength(3)
      expect(results[0]?.accountId).toBe('acc1')
      expect(results[1]).toBeNull()
      expect(results[2]?.accountId).toBe('acc2')
    })

    it('should return empty array for empty input', async () => {
      const results = await repository.getMany([])
      expect(results).toEqual([])
    })

    it('should handle duplicates in input', async () => {
      const results = await repository.getMany(['hash1', 'hash1'])

      expect(results).toHaveLength(2)
      expect(results[0]?.accountId).toBe('acc1')
      expect(results[1]?.accountId).toBe('acc1')
    })
  })

  describe('deleteMany', () => {
    beforeEach(async () => {
      await repository.set('hash1', 'acc1', 'claude-console')
      await repository.set('hash2', 'acc2', 'codex')
      await repository.set('hash3', 'acc3', 'claude-console')
    })

    it('should delete multiple mappings', async () => {
      await repository.deleteMany(['hash1', 'hash2'])

      const hash1Exists = await repository.exists('hash1')
      const hash2Exists = await repository.exists('hash2')
      const hash3Exists = await repository.exists('hash3')

      expect(hash1Exists).toBe(false)
      expect(hash2Exists).toBe(false)
      expect(hash3Exists).toBe(true)
    })

    it('should not throw when deleting non-existent mappings', async () => {
      await expect(repository.deleteMany(['non-existent1', 'non-existent2'])).resolves.toBeUndefined()
    })

    it('should handle empty input', async () => {
      await expect(repository.deleteMany([])).resolves.toBeUndefined()
    })
  })

  describe('TTL management', () => {
    it('should expire mapping after TTL', async () => {
      // Set with 1 second TTL
      await repository.set(testSessionHash, testMapping.accountId, testMapping.accountType, 1)

      // Should exist immediately
      let exists = await repository.exists(testSessionHash)
      expect(exists).toBe(true)

      // Wait 1.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Should be expired
      exists = await repository.exists(testSessionHash)
      expect(exists).toBe(false)
    })
  })
})
