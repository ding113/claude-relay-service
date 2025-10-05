/**
 * Usage Repository 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'
import { UsageRepository } from '@core/redis/repositories/usage.repository'
import type { UsageData } from '@shared/types'

describe('UsageRepository', () => {
  let redis: Redis
  let repository: UsageRepository

  const testKeyId = 'test-key-123'
  const testUsage: UsageData = {
    inputTokens: 100,
    outputTokens: 50,
    cacheCreateTokens: 20,
    cacheReadTokens: 10,
    model: 'claude-3-5-sonnet-20241022'
  }

  beforeEach(() => {
    redis = new RedisMock()
    repository = new UsageRepository(redis)
  })

  afterEach(async () => {
    await redis.flushall()
    await redis.quit()
  })

  describe('incrementUsage', () => {
    it('should increment total usage stats', async () => {
      await repository.incrementUsage(testKeyId, testUsage)

      const stats = await repository.getStats(testKeyId)

      expect(stats.total.inputTokens).toBe(100)
      expect(stats.total.outputTokens).toBe(50)
      expect(stats.total.cacheCreateTokens).toBe(20)
      expect(stats.total.cacheReadTokens).toBe(10)
      expect(stats.total.tokens).toBe(150) // core tokens only
      expect(stats.total.allTokens).toBe(180) // all tokens including cache
      expect(stats.total.requests).toBe(1)
    })

    it('should increment daily usage stats', async () => {
      await repository.incrementUsage(testKeyId, testUsage)

      const stats = await repository.getStats(testKeyId)

      expect(stats.daily?.inputTokens).toBe(100)
      expect(stats.daily?.outputTokens).toBe(50)
      expect(stats.daily?.tokens).toBe(150)
      expect(stats.daily?.requests).toBe(1)
    })

    it('should increment monthly usage stats', async () => {
      await repository.incrementUsage(testKeyId, testUsage)

      const stats = await repository.getStats(testKeyId)

      expect(stats.monthly?.inputTokens).toBe(100)
      expect(stats.monthly?.outputTokens).toBe(50)
      expect(stats.monthly?.tokens).toBe(150)
      expect(stats.monthly?.requests).toBe(1)
    })

    it('should accumulate multiple requests', async () => {
      await repository.incrementUsage(testKeyId, testUsage)
      await repository.incrementUsage(testKeyId, testUsage)
      await repository.incrementUsage(testKeyId, testUsage)

      const stats = await repository.getStats(testKeyId)

      expect(stats.total.inputTokens).toBe(300)
      expect(stats.total.outputTokens).toBe(150)
      expect(stats.total.tokens).toBe(450)
      expect(stats.total.requests).toBe(3)
    })

    it('should handle ephemeral tokens', async () => {
      const usageWithEphemeral: UsageData = {
        ...testUsage,
        ephemeral5mTokens: 30,
        ephemeral1hTokens: 40
      }

      await repository.incrementUsage(testKeyId, usageWithEphemeral)

      const stats = await repository.getStats(testKeyId)

      expect(stats.total.ephemeral5mTokens).toBe(30)
      expect(stats.total.ephemeral1hTokens).toBe(40)
    })

    it('should handle long context requests', async () => {
      const longContextUsage: UsageData = {
        ...testUsage,
        isLongContextRequest: true
      }

      await repository.incrementUsage(testKeyId, longContextUsage)

      const stats = await repository.getStats(testKeyId)

      expect(stats.total.longContextInputTokens).toBe(100)
      expect(stats.total.longContextOutputTokens).toBe(50)
      expect(stats.total.longContextRequests).toBe(1)
    })

    it('should handle zero values', async () => {
      const zeroUsage: UsageData = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreateTokens: 0,
        cacheReadTokens: 0,
        model: 'test-model'
      }

      await repository.incrementUsage(testKeyId, zeroUsage)

      const stats = await repository.getStats(testKeyId)

      expect(stats.total.requests).toBe(1) // Request counted even with zero tokens
      expect(stats.total.tokens).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should return empty stats when no usage exists', async () => {
      const stats = await repository.getStats('non-existent')

      expect(stats.total.requests).toBe(0)
      expect(stats.total.tokens).toBe(0)
      expect(stats.daily?.requests).toBe(0)
      expect(stats.monthly?.requests).toBe(0)
    })

    it('should return all dimensions of stats', async () => {
      await repository.incrementUsage(testKeyId, testUsage)

      const stats = await repository.getStats(testKeyId)

      expect(stats).toHaveProperty('total')
      expect(stats).toHaveProperty('daily')
      expect(stats).toHaveProperty('monthly')
    })
  })

  describe('incrementCost', () => {
    it('should increment cost in daily stats', async () => {
      await repository.incrementCost(testKeyId, 0.5)
      await repository.incrementCost(testKeyId, 0.3)

      const stats = await repository.getStats(testKeyId)

      expect(stats.daily?.cost).toBeCloseTo(0.8, 2)
    })

    it('should handle small decimal values', async () => {
      await repository.incrementCost(testKeyId, 0.001)
      await repository.incrementCost(testKeyId, 0.002)

      const stats = await repository.getStats(testKeyId)

      expect(stats.daily?.cost).toBeCloseTo(0.003, 3)
    })
  })

  describe('clear', () => {
    it('should clear all usage stats for a key', async () => {
      await repository.incrementUsage(testKeyId, testUsage)
      await repository.incrementCost(testKeyId, 1.0)

      // Verify data exists
      let stats = await repository.getStats(testKeyId)
      expect(stats.total.requests).toBe(1)

      // Clear data
      await repository.clear(testKeyId)

      // Verify data is cleared
      stats = await repository.getStats(testKeyId)
      expect(stats.total.requests).toBe(0)
      expect(stats.daily?.requests).toBe(0)
    })

    it('should not throw when clearing non-existent key', async () => {
      await expect(repository.clear('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('Multiple keys isolation', () => {
    it('should keep stats separate for different keys', async () => {
      const key1Usage: UsageData = { ...testUsage, inputTokens: 100 }
      const key2Usage: UsageData = { ...testUsage, inputTokens: 200 }

      await repository.incrementUsage('key1', key1Usage)
      await repository.incrementUsage('key2', key2Usage)

      const stats1 = await repository.getStats('key1')
      const stats2 = await repository.getStats('key2')

      expect(stats1.total.inputTokens).toBe(100)
      expect(stats2.total.inputTokens).toBe(200)
    })
  })

  describe('Edge cases', () => {
    it('should handle large token counts', async () => {
      const largeUsage: UsageData = {
        inputTokens: 1000000,
        outputTokens: 500000,
        cacheCreateTokens: 0,
        cacheReadTokens: 0,
        model: 'test-model'
      }

      await repository.incrementUsage(testKeyId, largeUsage)

      const stats = await repository.getStats(testKeyId)

      expect(stats.total.inputTokens).toBe(1000000)
      expect(stats.total.outputTokens).toBe(500000)
      expect(stats.total.tokens).toBe(1500000)
    })

    it('should handle mixed positive values', async () => {
      const usage1: UsageData = { inputTokens: 100, outputTokens: 0, cacheCreateTokens: 0, cacheReadTokens: 0, model: 'model1' }
      const usage2: UsageData = { inputTokens: 0, outputTokens: 200, cacheCreateTokens: 0, cacheReadTokens: 0, model: 'model2' }
      const usage3: UsageData = { inputTokens: 0, outputTokens: 0, cacheCreateTokens: 50, cacheReadTokens: 30, model: 'model3' }

      await repository.incrementUsage(testKeyId, usage1)
      await repository.incrementUsage(testKeyId, usage2)
      await repository.incrementUsage(testKeyId, usage3)

      const stats = await repository.getStats(testKeyId)

      expect(stats.total.inputTokens).toBe(100)
      expect(stats.total.outputTokens).toBe(200)
      expect(stats.total.cacheCreateTokens).toBe(50)
      expect(stats.total.cacheReadTokens).toBe(30)
      expect(stats.total.tokens).toBe(300) // core only
      expect(stats.total.allTokens).toBe(380) // all including cache
      expect(stats.total.requests).toBe(3)
    })
  })
})
