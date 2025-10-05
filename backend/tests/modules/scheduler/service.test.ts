/**
 * Scheduler Service 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import RedisMock from 'ioredis-mock'
import { SchedulerService } from '@/modules/scheduler/service'
import type { Account, AccountPlatform, ScheduleRequest } from '@/shared/types'

describe('SchedulerService', () => {
  let redis: RedisMock
  let scheduler: SchedulerService

  beforeEach(() => {
    redis = new RedisMock()
    scheduler = new SchedulerService(redis as any)
  })

  const createMockAccount = (
    id: string,
    platform: AccountPlatform,
    priority: number,
    isActive = true,
    schedulable = true,
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
    schedulable,
    isActive,
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

  describe('selectAccount', () => {
    it('should throw error when no available accounts', async () => {
      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: '' // 不指定模型，测试平台级别的错误
      }

      await expect(scheduler.selectAccount(request)).rejects.toThrowError(
        'No available accounts for platform: claude-console'
      )
    })

    it('should throw error when no accounts support model', async () => {
      // 创建一个账户，但不支持请求的模型
      const account = createMockAccount('acc1', 'claude-console', 10, true, true, {
        'claude-opus-4': 'claude-opus-4'
      })

      // 手动保存账户到 Redis
      await redis.hset(`claude_console_account:${account.id}`, {
        id: account.id,
        platform: account.platform,
        name: account.name,
        isActive: 'true',
        status: 'active',
        schedulable: 'true',
        priority: '10',
        supportedModels: JSON.stringify({ 'claude-opus-4': 'claude-opus-4' }),
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

      await redis.sadd('claude_console_accounts', account.id)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4' // 不支持的模型
      }

      await expect(scheduler.selectAccount(request)).rejects.toThrowError(
        'No available accounts support the requested model: claude-sonnet-4'
      )
    })

    it('should select account when available', async () => {
      // 创建账户
      const account = createMockAccount('acc1', 'claude-console', 10)

      // 手动保存账户到 Redis
      await redis.hset(`claude_console_account:${account.id}`, {
        id: account.id,
        platform: account.platform,
        name: account.name,
        isActive: 'true',
        status: 'active',
        schedulable: 'true',
        priority: '10',
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

      await redis.sadd('claude_console_accounts', account.id)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const result = await scheduler.selectAccount(request)

      expect(result.account.id).toBe('acc1')
      expect(result.isSticky).toBe(false)
      expect(result.attemptCount).toBe(1)
    })

    it('should select account with highest priority', async () => {
      // 创建三个账户，不同优先级
      const accounts = [
        createMockAccount('acc1', 'claude-console', 50),
        createMockAccount('acc2', 'claude-console', 10), // 最高优先级
        createMockAccount('acc3', 'claude-console', 30)
      ]

      // 保存所有账户到 Redis
      for (const account of accounts) {
        await redis.hset(`claude_console_account:${account.id}`, {
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

        await redis.sadd('claude_console_accounts', account.id)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const result = await scheduler.selectAccount(request)

      // 应该选择 priority 10 的账户
      expect(result.account.id).toBe('acc2')
      expect(result.account.priority).toBe(10)
    })

    it('should exclude specified account IDs', async () => {
      // 创建两个账户
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      // 保存所有账户到 Redis
      for (const account of accounts) {
        await redis.hset(`claude_console_account:${account.id}`, {
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

        await redis.sadd('claude_console_accounts', account.id)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      // 排除 acc1
      const excludeIds = new Set(['acc1'])
      const result = await scheduler.selectAccount(request, { excludeIds })

      // 应该选择 acc2
      expect(result.account.id).toBe('acc2')
    })

    it('should filter accounts by model support', async () => {
      // 创建两个账户，一个支持 Opus，一个支持 Sonnet
      const account1 = createMockAccount('acc1', 'claude-console', 10, true, true, {
        'claude-opus-4': 'claude-opus-4'
      })

      const account2 = createMockAccount('acc2', 'claude-console', 10, true, true, {
        'claude-sonnet-4': 'claude-sonnet-4'
      })

      // 保存账户到 Redis
      for (const account of [account1, account2]) {
        await redis.hset(`claude_console_account:${account.id}`, {
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

        await redis.sadd('claude_console_accounts', account.id)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const result = await scheduler.selectAccount(request)

      // 应该选择支持 Sonnet 的账户
      expect(result.account.id).toBe('acc2')
    })

    it('should filter out inactive accounts', async () => {
      // 创建两个账户，一个激活，一个未激活
      const account1 = createMockAccount('acc1', 'claude-console', 10, false) // 未激活
      const account2 = createMockAccount('acc2', 'claude-console', 10, true)  // 激活

      // 保存账户到 Redis
      for (const account of [account1, account2]) {
        await redis.hset(`claude_console_account:${account.id}`, {
          id: account.id,
          platform: account.platform,
          name: account.name,
          isActive: account.isActive ? 'true' : 'false',
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

        await redis.sadd('claude_console_accounts', account.id)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const result = await scheduler.selectAccount(request)

      // 应该选择激活的账户
      expect(result.account.id).toBe('acc2')
      expect(result.account.isActive).toBe(true)
    })

    it('should filter out non-schedulable accounts', async () => {
      // 创建两个账户，一个可调度，一个不可调度
      const account1 = createMockAccount('acc1', 'claude-console', 10, true, false) // 不可调度
      const account2 = createMockAccount('acc2', 'claude-console', 10, true, true)  // 可调度

      // 保存账户到 Redis
      for (const account of [account1, account2]) {
        await redis.hset(`claude_console_account:${account.id}`, {
          id: account.id,
          platform: account.platform,
          name: account.name,
          isActive: 'true',
          status: 'active',
          schedulable: account.schedulable ? 'true' : 'false',
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

        await redis.sadd('claude_console_accounts', account.id)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4'
      }

      const result = await scheduler.selectAccount(request)

      // 应该选择可调度的账户
      expect(result.account.id).toBe('acc2')
      expect(result.account.schedulable).toBe(true)
    })
  })

  describe('sticky session', () => {
    it('should create session mapping when sessionHash provided', async () => {
      // 创建账户
      const account = createMockAccount('acc1', 'claude-console', 10)

      // 保存账户到 Redis
      await redis.hset(`claude_console_account:${account.id}`, {
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

      await redis.sadd('claude_console_accounts', account.id)

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash: 'session-123'
      }

      await scheduler.selectAccount(request)

      // 验证会话映射已创建
      const mapping = await redis.hgetall('unified_claude_session_mapping:session-123')
      expect(mapping.accountId).toBe('acc1')
      expect(mapping.accountType).toBe('claude-console')
    })

    it('should reuse session mapping when available', async () => {
      // 创建两个账户
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      // 保存账户到 Redis
      for (const account of accounts) {
        await redis.hset(`claude_console_account:${account.id}`, {
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

        await redis.sadd('claude_console_accounts', account.id)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash: 'session-123'
      }

      // 第一次请求
      const result1 = await scheduler.selectAccount(request)
      const firstAccountId = result1.account.id

      // 第二次请求（相同会话哈希）
      const result2 = await scheduler.selectAccount(request)

      // 应该返回同一个账户
      expect(result2.account.id).toBe(firstAccountId)
      expect(result2.isSticky).toBe(true)
    })

    it('should delete session mapping if account excluded', async () => {
      // 创建两个账户
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      // 保存账户到 Redis
      for (const account of accounts) {
        await redis.hset(`claude_console_account:${account.id}`, {
          id: account.id,
          platform: account.platform,
          name: account.name,
          isActive: 'true',
          status: 'active',
          schedulable: 'true',
          priority: account.priority.toString(),
          supportedModels: JSON.stringify({}),
          apiUrl: account.apiKey,
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

        await redis.sadd('claude_console_accounts', account.id)
      }

      const request: ScheduleRequest = {
        platform: 'claude-console',
        model: 'claude-sonnet-4',
        sessionHash: 'session-123'
      }

      // 第一次请求 - 创建会话映射
      const result1 = await scheduler.selectAccount(request)
      const firstAccountId = result1.account.id

      // 第二次请求 - 排除第一个账户
      const excludeIds = new Set([firstAccountId])
      const result2 = await scheduler.selectAccount(request, { excludeIds })

      // 应该选择另一个账户
      expect(result2.account.id).not.toBe(firstAccountId)
      expect(result2.isSticky).toBe(false)

      // 验证会话映射已删除并重新创建
      const mapping = await redis.hgetall('unified_claude_session_mapping:session-123')
      expect(mapping.accountId).toBe(result2.account.id)
    })
  })
})
