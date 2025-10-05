/**
 * Scheduler Integration Tests
 * 端到端场景测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import RedisMock from 'ioredis-mock'
import { SchedulerService } from '@/modules/scheduler/service'
import { RetryHandler } from '@/modules/scheduler/retry'
import type { Account, ScheduleRequest } from '@/shared/types'

describe('Scheduler Integration', () => {
  let redis: RedisMock
  let scheduler: SchedulerService
  let retryHandler: RetryHandler

  beforeEach(async () => {
    redis = new RedisMock()
    await redis.flushall()
    scheduler = new SchedulerService(redis as any)
    retryHandler = new RetryHandler(redis as any, 5)
  })

  const createMockAccount = (
    id: string,
    platform: 'claude-console' | 'codex',
    priority: number,
    supportedModels: Record<string, string> = {}
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
    supportedModels,
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
    const prefix = account.platform === 'claude-console' ? 'claude_console_account' : 'codex_account'
    const setKey = account.platform === 'claude-console' ? 'claude_console_accounts' : 'codex_accounts'

    await redis.hset(`${prefix}:${account.id}`, {
      id: account.id,
      platform: account.platform,
      name: account.name,
      isActive: 'true',
      status: 'active',
      schedulable: 'true',
      priority: account.priority.toString(),
      supportedModels: JSON.stringify(account.supportedModels),
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

    await redis.sadd(setKey, account.id)
  }

  describe('Scenario 1: Sticky Session', () => {
    it('should maintain session sticky across multiple requests', async () => {
      // 创建 3 个账户
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10),
        createMockAccount('acc3', 'claude-console', 10)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash: 'sticky-session-123'
      }

      // 第一次请求 - 创建会话映射
      const result1 = await scheduler.selectAccount(request)
      expect(result1.isSticky).toBe(false) // 首次请求不是 sticky

      const firstAccountId = result1.account.id

      // 第二次请求 - 应该返回相同账户
      const result2 = await scheduler.selectAccount(request)
      expect(result2.isSticky).toBe(true)
      expect(result2.account.id).toBe(firstAccountId)

      // 第三次请求 - 仍然返回相同账户
      const result3 = await scheduler.selectAccount(request)
      expect(result3.isSticky).toBe(true)
      expect(result3.account.id).toBe(firstAccountId)

      // 验证会话映射存在
      const mapping = await redis.hgetall('unified_claude_session_mapping:sticky-session-123')
      expect(mapping.accountId).toBe(firstAccountId)
      expect(mapping.accountType).toBe('claude-console')
    })

    it('should auto-extend session mapping when TTL < 14 days', async () => {
      const account = createMockAccount('acc1', 'claude-console', 10)
      await saveAccountToRedis(account)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash: 'extend-session-123'
      }

      // 第一次请求 - 创建会话映射（TTL = 15 天 = 1296000 秒）
      await scheduler.selectAccount(request)

      // 手动设置 TTL 为 13 天（< 14 天阈值）
      await redis.expire('unified_claude_session_mapping:extend-session-123', 13 * 24 * 60 * 60)

      const ttlBefore = await redis.ttl('unified_claude_session_mapping:extend-session-123')
      expect(ttlBefore).toBeGreaterThan(12 * 24 * 60 * 60)
      expect(ttlBefore).toBeLessThan(14 * 24 * 60 * 60)

      // 第二次请求 - 应该自动续期到 15 天
      await scheduler.selectAccount(request)

      const ttlAfter = await redis.ttl('unified_claude_session_mapping:extend-session-123')
      expect(ttlAfter).toBeGreaterThan(14 * 24 * 60 * 60)
      expect(ttlAfter).toBeLessThanOrEqual(15 * 24 * 60 * 60)
    })
  })

  describe('Scenario 2: Priority + Load Balancing', () => {
    it('should select only from highest priority group', async () => {
      // 创建账户：2 个高优先级（priority 10），2 个低优先级（priority 20）
      const accounts = [
        createMockAccount('high1', 'claude-console', 10),
        createMockAccount('high2', 'claude-console', 10),
        createMockAccount('low1', 'claude-console', 20),
        createMockAccount('low2', 'claude-console', 20)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      // 多次请求，应该只在高优先级组中轮询
      const selectedIds: string[] = []

      for (let i = 0; i < 10; i++) {
        const result = await scheduler.selectAccount(request)
        selectedIds.push(result.account.id)
        expect(result.account.priority).toBe(10) // 只选择高优先级
      }

      // 验证轮询：应该包含 high1 和 high2，但不包含 low1 和 low2
      expect(selectedIds).toContain('high1')
      expect(selectedIds).toContain('high2')
      expect(selectedIds).not.toContain('low1')
      expect(selectedIds).not.toContain('low2')
    })

    it('should round-robin within same priority group', async () => {
      // 创建 3 个相同优先级的账户
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10),
        createMockAccount('acc3', 'claude-console', 10)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      // 选择 9 次，应该每个账户各 3 次
      const selectedIds: string[] = []

      for (let i = 0; i < 9; i++) {
        const result = await scheduler.selectAccount(request)
        selectedIds.push(result.account.id)
      }

      // 验证轮询：每个账户应该被选中 3 次
      expect(selectedIds.filter(id => id === 'acc1').length).toBe(3)
      expect(selectedIds.filter(id => id === 'acc2').length).toBe(3)
      expect(selectedIds.filter(id => id === 'acc3').length).toBe(3)

      // 验证顺序：acc1 -> acc2 -> acc3 -> acc1 -> ...
      expect(selectedIds).toEqual([
        'acc1', 'acc2', 'acc3',
        'acc1', 'acc2', 'acc3',
        'acc1', 'acc2', 'acc3'
      ])
    })
  })

  describe('Scenario 3: Model Filtering', () => {
    it('should filter accounts by model support', async () => {
      // 创建账户：acc1 只支持 Opus，acc2 只支持 Sonnet
      const accounts = [
        createMockAccount('opus-only', 'claude-console', 10, { 'claude-opus-4': 'claude-opus-4' }),
        createMockAccount('sonnet-only', 'claude-console', 10, { 'claude-sonnet-4': 'claude-sonnet-4' }),
        createMockAccount('all-models', 'claude-console', 20, {}) // 空对象 = 支持所有模型
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      // 请求 Sonnet 模型
      const sonnetRequest: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const sonnetResult = await scheduler.selectAccount(sonnetRequest)
      expect(sonnetResult.account.id).toBe('sonnet-only')

      // 请求 Opus 模型
      const opusRequest: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-opus-4'
      }

      const opusResult = await scheduler.selectAccount(opusRequest)
      expect(opusResult.account.id).toBe('opus-only')

      // 请求不存在的模型（应该选择支持所有模型的账户）
      const unknownRequest: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-haiku-4'
      }

      const unknownResult = await scheduler.selectAccount(unknownRequest)
      expect(unknownResult.account.id).toBe('all-models')
    })
  })

  describe('Scenario 4: Retry on Failure', () => {
    it('should exclude failed accounts and retry', async () => {
      // 创建 3 个账户
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10),
        createMockAccount('acc3', 'claude-console', 10)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      // 第一次选择
      const result1 = await retryHandler.selectWithRetry(request)
      const failedId1 = result1.account.id

      // 模拟失败，排除第一个账户
      const excludeIds = new Set([failedId1])
      const result2 = await retryHandler.selectWithRetry(request, { excludeIds })
      expect(result2.account.id).not.toBe(failedId1)

      const failedId2 = result2.account.id

      // 再次失败，排除前两个账户
      excludeIds.add(failedId2)
      const result3 = await retryHandler.selectWithRetry(request, { excludeIds })
      expect(result3.account.id).not.toBe(failedId1)
      expect(result3.account.id).not.toBe(failedId2)
    })

    it('should throw error when all accounts are excluded', async () => {
      // 创建 2 个账户
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
  })

  describe('Scenario 5: Account Availability', () => {
    it('should filter out inactive accounts', async () => {
      // 创建账户：一个激活，一个未激活
      const activeAccount = createMockAccount('active', 'claude-console', 10)
      const inactiveAccount = createMockAccount('inactive', 'claude-console', 10)

      await saveAccountToRedis(activeAccount)

      // 保存未激活账户
      await redis.hset(`claude_console_account:${inactiveAccount.id}`, {
        id: inactiveAccount.id,
        platform: inactiveAccount.platform,
        name: inactiveAccount.name,
        isActive: 'false', // 未激活
        status: 'active',
        schedulable: 'true',
        priority: '10',
        supportedModels: JSON.stringify({}),
        apiUrl: inactiveAccount.apiUrl,
        apiKey: inactiveAccount.apiKey,
        createdAt: inactiveAccount.createdAt,
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

      await redis.sadd('claude_console_accounts', inactiveAccount.id)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const result = await scheduler.selectAccount(request)

      // 应该选择激活的账户
      expect(result.account.id).toBe('active')
    })

    it('should filter out non-schedulable accounts', async () => {
      // 创建账户：一个可调度，一个不可调度
      const schedulableAccount = createMockAccount('schedulable', 'claude-console', 10)
      const nonSchedulableAccount = createMockAccount('non-schedulable', 'claude-console', 10)

      await saveAccountToRedis(schedulableAccount)

      // 保存不可调度账户
      await redis.hset(`claude_console_account:${nonSchedulableAccount.id}`, {
        id: nonSchedulableAccount.id,
        platform: nonSchedulableAccount.platform,
        name: nonSchedulableAccount.name,
        isActive: 'true',
        status: 'active',
        schedulable: 'false', // 不可调度
        priority: '10',
        supportedModels: JSON.stringify({}),
        apiUrl: nonSchedulableAccount.apiUrl,
        apiKey: nonSchedulableAccount.apiKey,
        createdAt: nonSchedulableAccount.createdAt,
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

      await redis.sadd('claude_console_accounts', nonSchedulableAccount.id)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const result = await scheduler.selectAccount(request)

      // 应该选择可调度的账户
      expect(result.account.id).toBe('schedulable')
    })
  })

  describe('Scenario 6: Complex Workflow', () => {
    it('should handle sticky session + retry + load balancing', async () => {
      // 创建 4 个账户
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10),
        createMockAccount('acc3', 'claude-console', 20),
        createMockAccount('acc4', 'claude-console', 20)
      ]

      for (const account of accounts) {
        await saveAccountToRedis(account)
      }

      const sessionHash = 'complex-session-123'

      // 第一次请求 - 创建会话映射
      const request1: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash
      }

      const result1 = await scheduler.selectAccount(request1)
      expect(result1.isSticky).toBe(false)
      expect(result1.account.priority).toBe(10) // 高优先级

      const stickyAccountId = result1.account.id

      // 第二次请求 - 应该返回相同账户（sticky）
      const result2 = await scheduler.selectAccount(request1)
      expect(result2.isSticky).toBe(true)
      expect(result2.account.id).toBe(stickyAccountId)

      // 模拟失败，排除 sticky 账户，应该选择另一个高优先级账户
      const request2: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash
      }

      const excludeIds = new Set([stickyAccountId])
      const result3 = await retryHandler.selectWithRetry(request2, { excludeIds })

      expect(result3.account.id).not.toBe(stickyAccountId)
      expect(result3.account.priority).toBe(10) // 仍然是高优先级
      expect(result3.isSticky).toBe(false) // 会话映射已被清除
    })
  })
})
