/**
 * Retry Handler 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import RedisMock from 'ioredis-mock'
import { RetryHandler } from '@/modules/scheduler/retry'
import type { Account, ScheduleRequest } from '@/shared/types'

describe('RetryHandler', () => {
  let redis: RedisMock
  let retryHandler: RetryHandler

  beforeEach(async () => {
    redis = new RedisMock()
    await redis.flushall() // 清空所有数据
    retryHandler = new RetryHandler(redis as any, 5)
  })

  const createMockAccount = (
    id: string,
    platform: 'claude-console' | 'codex',
    priority: number
  ): Account => ({
    id,
    platform,
    name: `Account ${id}`,
    description: '',
    createdAt: new Date().toISOString(),
    lastUsedAt: '',
    apiUrl: 'https://api.example.com',
    apiKey: 'test-key',
    userAgent: '',
    supportedModels: {},
    priority,
    schedulable: true,
    isActive: true,
    status: 'active',
    errorMessage: '',
    rateLimitDuration: 0,
    rateLimitStatus: '',
    dailyQuota: 0,
    dailyUsage: 0,
    lastResetDate: '',
    quotaResetTime: '00:00',
    accountType: 'shared',
    proxy: null
  })

  const saveAccountToRedis = async (account: Account) => {
    await redis.hset(`${account.platform === 'claude-console' ? 'claude_console_account' : 'codex_account'}:${account.id}`, {
      id: account.id,
      platform: account.platform,
      name: account.name,
      isActive: 'true',
      status: 'active',
      schedulable: 'true',
      priority: account.priority.toString(),
      supportedModels: JSON.stringify({}),
      apiUrl: account.apiUrl,
      apiKey: account.apiKey,
      createdAt: account.createdAt,
      updatedAt: '',
      lastUsedAt: '',
      userAgent: '',
      rateLimitDuration: '0',
      rateLimitedAt: '',
      rateLimitStatus: '',
      dailyQuota: '0',
      dailyUsage: '0',
      lastResetDate: '',
      quotaResetTime: '00:00',
      accountType: 'shared',
      proxy: '',
      errorMessage: '',
      rateLimitAutoStopped: '',
      quotaStoppedAt: '',
      quotaAutoStopped: '',
      unauthorizedAt: '',
      unauthorizedCount: '0',
      overloadedAt: '',
      overloadStatus: '',
      blockedAt: ''
    })

    await redis.sadd(
      account.platform === 'claude-console' ? 'claude_console_accounts' : 'codex_accounts',
      account.id
    )
  }

  describe('selectWithRetry', () => {
    it('should select account on first attempt when available', async () => {
      const account = createMockAccount('acc1', 'claude-console', 10)
      await saveAccountToRedis(account)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const result = await retryHandler.selectWithRetry(request)

      expect(result.account.id).toBe('acc1')
      expect(result.attemptCount).toBe(1)
    })

    it('should throw error when no accounts available', async () => {
      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: ''
      }

      await expect(retryHandler.selectWithRetry(request)).rejects.toThrowError(
        /All retry attempts exhausted/
      )
    })

    it('should respect maxRetries option', async () => {
      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: ''
      }

      // 自定义最大重试次数为 3
      const customRetryHandler = new RetryHandler(redis as any, 3)

      try {
        await customRetryHandler.selectWithRetry(request)
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('All retry attempts exhausted (3)')
      }
    })

    it('should exclude specified account IDs', async () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      // 排除 acc1
      const excludeIds = new Set(['acc1'])
      const result = await retryHandler.selectWithRetry(request, { excludeIds })

      // 应该选择 acc2
      expect(result.account.id).toBe('acc2')
    })

    it('should skip excluded accounts during retry', async () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 20) // 低优先级
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      // 第一次选择（不排除）
      const result1 = await retryHandler.selectWithRetry(request)
      expect(result1.account.id).toBe('acc1') // 高优先级

      // 第二次选择（排除 acc1）
      const excludeIds = new Set(['acc1'])
      const result2 = await retryHandler.selectWithRetry(request, { excludeIds })
      expect(result2.account.id).toBe('acc2') // 低优先级
    })

    it('should throw error when all accounts are excluded', async () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      // 排除所有账户
      const excludeIds = new Set(['acc1', 'acc2'])

      await expect(retryHandler.selectWithRetry(request, { excludeIds })).rejects.toThrowError(
        /All retry attempts exhausted/
      )
    })

    it('should work with session hash', async () => {
      const account = createMockAccount('acc1', 'claude-console', 10)
      await saveAccountToRedis(account)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash: 'session-123'
      }

      const result = await retryHandler.selectWithRetry(request)

      expect(result.account.id).toBe('acc1')

      // 验证会话映射已创建
      const mapping = await redis.hgetall('unified_claude_session_mapping:session-123')
      expect(mapping.accountId).toBe('acc1')
    })

    it('should reuse sticky session on retry', async () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash: 'session-123'
      }

      // 第一次选择
      const result1 = await retryHandler.selectWithRetry(request)
      const firstAccountId = result1.account.id

      // 第二次选择（相同会话哈希）
      const result2 = await retryHandler.selectWithRetry(request)

      // 应该返回同一个账户
      expect(result2.account.id).toBe(firstAccountId)
      expect(result2.isSticky).toBe(true)
    })

    it('should bypass sticky session if excluded', async () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash: 'session-123'
      }

      // 第一次选择 - 创建会话映射
      const result1 = await retryHandler.selectWithRetry(request)
      const firstAccountId = result1.account.id

      // 第二次选择 - 排除第一个账户
      const excludeIds = new Set([firstAccountId])
      const result2 = await retryHandler.selectWithRetry(request, { excludeIds })

      // 应该选择另一个账户
      expect(result2.account.id).not.toBe(firstAccountId)
      expect(result2.isSticky).toBe(false)
    })

    it('should handle custom maxRetries from options', async () => {
      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: ''
      }

      try {
        await retryHandler.selectWithRetry(request, { maxRetries: 2 })
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('All retry attempts exhausted (2)')
      }
    })
  })

  describe('getScheduler', () => {
    it('should return scheduler instance', () => {
      const scheduler = retryHandler.getScheduler()
      expect(scheduler).toBeDefined()
    })
  })

  describe('getMaxRetries', () => {
    it('should return maxRetries value', () => {
      expect(retryHandler.getMaxRetries()).toBe(5)
    })

    it('should return custom maxRetries value', () => {
      const customRetryHandler = new RetryHandler(redis as any, 3)
      expect(customRetryHandler.getMaxRetries()).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('should handle zero maxRetries', async () => {
      const account = createMockAccount('acc1', 'claude-console', 10)
      await saveAccountToRedis(account)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const zeroRetryHandler = new RetryHandler(redis as any, 0)

      // maxRetries = 0 应该至少尝试一次
      const result = await zeroRetryHandler.selectWithRetry(request)
      expect(result.account.id).toBe('acc1')
    })

    it('should handle negative maxRetries', async () => {
      const account = createMockAccount('acc1', 'claude-console', 10)
      await saveAccountToRedis(account)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const negativeRetryHandler = new RetryHandler(redis as any, -1)

      // 负数应该至少尝试一次
      const result = await negativeRetryHandler.selectWithRetry(request)
      expect(result.account.id).toBe('acc1')
    })
  })
})
