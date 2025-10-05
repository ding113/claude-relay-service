/**
 * Load Balancer
 * 负载均衡器 - 按优先级 + 轮询选择账户
 * 改进 v1 的 lastUsedAt 排序（不准确）
 */

import type { Account } from '@/shared/types'
import logger from '@/core/logger'

export class LoadBalancer {
  // 轮询计数器：key = 'platform:priority'
  private counters: Map<string, number> = new Map()

  /**
   * 按优先级 + 轮询选择账户
   * @param accounts - 可用账户列表（已按优先级排序）
   * @returns 选中的账户
   */
  select(accounts: Account[]): Account {
    if (accounts.length === 0) {
      throw new Error('No accounts to select from')
    }

    // 单账户直接返回
    if (accounts.length === 1) {
      return accounts[0]
    }

    // 按优先级分组
    const groups = this.groupByPriority(accounts)

    // 选择最高优先级组（数字小 = 优先级高）
    const highestPriority = Math.min(...groups.keys())
    const candidates = groups.get(highestPriority)!

    // 如果只有一个候选账户，直接返回
    if (candidates.length === 1) {
      return candidates[0]
    }

    // 轮询选择
    const key = `${candidates[0].platform}:${highestPriority}`
    const counter = this.counters.get(key) || 0
    const selected = candidates[counter % candidates.length]

    // 更新计数器
    this.counters.set(key, counter + 1)

    logger.debug({
      platform: selected.platform,
      priority: highestPriority,
      candidatesCount: candidates.length,
      counter,
      selectedId: selected.id
    }, 'Load balancer selected account')

    return selected
  }

  /**
   * 按优先级分组账户
   * @param accounts - 账户列表
   * @returns 分组后的 Map
   */
  private groupByPriority(accounts: Account[]): Map<number, Account[]> {
    const groups = new Map<number, Account[]>()

    for (const account of accounts) {
      const priority = account.priority
      const list = groups.get(priority) || []
      list.push(account)
      groups.set(priority, list)
    }

    return groups
  }

  /**
   * 重置计数器（用于测试）
   */
  reset(): void {
    this.counters.clear()
  }

  /**
   * 获取计数器状态（用于调试）
   */
  getCounters(): Map<string, number> {
    return new Map(this.counters)
  }
}
