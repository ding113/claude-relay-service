/**
 * 会话映射数据结构
 * 对应 v1 的 unifiedClaudeScheduler.js 中的 session mapping
 */

/**
 * 会话映射数据
 */
export interface SessionMapping {
  sessionHash: string
  accountId: string
  accountType: 'claude-console' | 'codex' | 'claude-official' // 保留 v1 兼容
  createdAt: string // ISO 8601
  lastAccessedAt: string // ISO 8601
  ttl: number // 秒
}

/**
 * 会话映射（Redis 存储格式）
 */
export interface SessionMappingData {
  accountId: string
  accountType: string
}
