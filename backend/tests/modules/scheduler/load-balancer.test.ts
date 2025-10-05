/**
 * Load Balancer 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LoadBalancer } from '@/modules/scheduler/load-balancer'
import type { Account } from '@/shared/types'

describe('LoadBalancer', () => {
  let loadBalancer: LoadBalancer

  beforeEach(() => {
    loadBalancer = new LoadBalancer()
  })

  const createMockAccount = (id: string, platform: 'claude-console' | 'codex', priority: number): Account => ({
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

  describe('select', () => {
    it('should throw error when no accounts provided', () => {
      expect(() => loadBalancer.select([])).toThrowError('No accounts to select from')
    })

    it('should return the only account when one account provided', () => {
      const account = createMockAccount('acc1', 'claude-console', 10)
      const selected = loadBalancer.select([account])

      expect(selected).toBe(account)
    })

    it('should select account with highest priority (lowest number)', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 50),
        createMockAccount('acc2', 'claude-console', 10), // 最高优先级
        createMockAccount('acc3', 'claude-console', 30)
      ]

      const selected = loadBalancer.select(accounts)

      expect(selected.id).toBe('acc2')
      expect(selected.priority).toBe(10)
    })

    it('should round-robin among accounts with same priority', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10),
        createMockAccount('acc3', 'claude-console', 10)
      ]

      // 第一次选择
      const first = loadBalancer.select(accounts)
      expect(first.id).toBe('acc1')

      // 第二次选择
      const second = loadBalancer.select(accounts)
      expect(second.id).toBe('acc2')

      // 第三次选择
      const third = loadBalancer.select(accounts)
      expect(third.id).toBe('acc3')

      // 第四次选择（循环回到第一个）
      const fourth = loadBalancer.select(accounts)
      expect(fourth.id).toBe('acc1')
    })

    it('should select only from highest priority group', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10), // 高优先级
        createMockAccount('acc2', 'claude-console', 10), // 高优先级
        createMockAccount('acc3', 'claude-console', 20), // 低优先级
        createMockAccount('acc4', 'claude-console', 20)  // 低优先级
      ]

      // 多次选择，只会在 priority 10 的账户中轮询
      const first = loadBalancer.select(accounts)
      expect(first.priority).toBe(10)

      const second = loadBalancer.select(accounts)
      expect(second.priority).toBe(10)

      const third = loadBalancer.select(accounts)
      expect(third.priority).toBe(10)

      // 验证轮询
      expect([first.id, second.id, third.id]).toEqual(['acc1', 'acc2', 'acc1'])
    })

    it('should handle different platforms separately', () => {
      const claudeAccounts = [
        createMockAccount('claude1', 'claude-console', 10),
        createMockAccount('claude2', 'claude-console', 10)
      ]

      const codexAccounts = [
        createMockAccount('codex1', 'codex', 10),
        createMockAccount('codex2', 'codex', 10)
      ]

      // Claude 平台轮询
      const claude1 = loadBalancer.select(claudeAccounts)
      expect(claude1.id).toBe('claude1')

      const claude2 = loadBalancer.select(claudeAccounts)
      expect(claude2.id).toBe('claude2')

      // Codex 平台轮询（独立计数器）
      const codex1 = loadBalancer.select(codexAccounts)
      expect(codex1.id).toBe('codex1')

      const codex2 = loadBalancer.select(codexAccounts)
      expect(codex2.id).toBe('codex2')

      // Claude 平台继续轮询（回到第一个）
      const claude3 = loadBalancer.select(claudeAccounts)
      expect(claude3.id).toBe('claude1')
    })

    it('should handle mixed priority and platform', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10),
        createMockAccount('acc3', 'claude-console', 20),
        createMockAccount('acc4', 'codex', 10)
      ]

      // 选择应该在最高优先级（10）中进行
      const selected = loadBalancer.select(accounts)

      // 应该是 priority 10 的账户
      expect(selected.priority).toBe(10)
      expect(['acc1', 'acc2', 'acc4']).toContain(selected.id)
    })
  })

  describe('reset', () => {
    it('should reset all counters', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      // 选择几次
      loadBalancer.select(accounts)
      loadBalancer.select(accounts)

      // 重置
      loadBalancer.reset()

      // 应该从第一个开始
      const selected = loadBalancer.select(accounts)
      expect(selected.id).toBe('acc1')
    })
  })

  describe('getCounters', () => {
    it('should return current counter state', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      // 选择两次
      loadBalancer.select(accounts)
      loadBalancer.select(accounts)

      const counters = loadBalancer.getCounters()
      expect(counters.get('claude-console:10')).toBe(2)
    })

    it('should return empty map initially', () => {
      const counters = loadBalancer.getCounters()
      expect(counters.size).toBe(0)
    })
  })

  describe('groupByPriority', () => {
    it('should group accounts by priority', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 20),
        createMockAccount('acc3', 'claude-console', 10),
        createMockAccount('acc4', 'claude-console', 30)
      ]

      // 通过选择验证分组逻辑
      const selected = loadBalancer.select(accounts)
      expect(selected.priority).toBe(10)
    })
  })

  describe('edge cases', () => {
    it('should handle single account in a priority group', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10)
      ]

      // 多次选择应该都返回同一个账户
      expect(loadBalancer.select(accounts).id).toBe('acc1')
      expect(loadBalancer.select(accounts).id).toBe('acc1')
      expect(loadBalancer.select(accounts).id).toBe('acc1')
    })

    it('should handle large counter values (overflow protection)', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      // 模拟大量请求
      for (let i = 0; i < 1000; i++) {
        const selected = loadBalancer.select(accounts)
        // 应该始终是两个账户之一
        expect(['acc1', 'acc2']).toContain(selected.id)
      }

      // 验证计数器值
      const counters = loadBalancer.getCounters()
      expect(counters.get('claude-console:10')).toBe(1000)
    })

    it('should handle zero priority', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', 0),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      // 应该选择 priority 0（最高优先级）
      const selected = loadBalancer.select(accounts)
      expect(selected.priority).toBe(0)
    })

    it('should handle negative priority', () => {
      const accounts = [
        createMockAccount('acc1', 'claude-console', -10),
        createMockAccount('acc2', 'claude-console', 10)
      ]

      // 应该选择 priority -10（最高优先级）
      const selected = loadBalancer.select(accounts)
      expect(selected.priority).toBe(-10)
    })
  })
})
