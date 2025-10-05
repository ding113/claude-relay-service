/**
 * 调度器类型定义
 * 对应 v1 的 unifiedClaudeScheduler.js
 * v2 改进：添加重试支持 + 排除失败账户
 */

import type { Account, AccountPlatform } from './account'

/**
 * 调度请求
 */
export interface ScheduleRequest {
  platform: AccountPlatform
  model: string
  sessionHash?: string
}

/**
 * 调度结果
 */
export interface ScheduleResult {
  account: Account
  isSticky: boolean // 是否来自会话映射
  attemptCount: number // 第几次尝试
}

/**
 * 调度选项
 */
export interface ScheduleOptions {
  maxRetries?: number // 最大重试次数（默认 5）
  excludeIds?: Set<string> // 排除的账户 ID（失败的账户）
}
