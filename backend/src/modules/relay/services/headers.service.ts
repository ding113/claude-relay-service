/**
 * Headers Service
 * Claude Code headers 管理服务
 * 对应 v1 的 claudeCodeHeadersService
 */

import type Redis from 'ioredis'
import logger from '@/core/logger'
import { redisClient } from '@/core/redis/client'
import { CLAUDE_CODE_REQUIRED_HEADERS, DEFAULT_CLAUDE_CODE_HEADERS } from '@/shared/types/client-validator'

interface StoredHeaders {
  headers: Record<string, string>
  version: string
  updatedAt: string
}

export class HeadersService {
  private redis: Redis

  constructor(redis?: Redis) {
    this.redis = redis || redisClient.getClient()
  }

  /**
   * 存储账户的 Claude Code headers
   * @param accountId - 账户 ID
   * @param clientHeaders - 客户端 headers
   */
  async storeAccountHeaders(
    accountId: string,
    clientHeaders: Record<string, string | string[] | undefined>
  ): Promise<void> {
    try {
      const extractedHeaders = this.extractClaudeCodeHeaders(clientHeaders)

      // 检查是否有 user-agent
      const userAgent = extractedHeaders['user-agent']
      if (!userAgent || !/^claude-cli\/[\d.]+\s+\(/i.test(userAgent)) {
        // 不是 Claude Code 的请求，不存储
        return
      }

      const version = this.extractVersionFromUserAgent(userAgent)
      if (!version) {
        logger.warn({ userAgent }, 'Failed to extract version from user-agent')
        return
      }

      // 获取当前存储的 headers
      const key = `claude_code_headers:${accountId}`
      const currentData = await this.redis.get(key)

      if (currentData) {
        const current: StoredHeaders = JSON.parse(currentData)
        const currentVersion = this.extractVersionFromUserAgent(current.headers['user-agent'])

        // 只有新版本更高时才更新
        if (currentVersion && this.compareVersions(version, currentVersion) <= 0) {
          return
        }
      }

      // 存储新的 headers
      const data: StoredHeaders = {
        headers: extractedHeaders,
        version,
        updatedAt: new Date().toISOString()
      }

      await this.redis.setex(key, 86400 * 7, JSON.stringify(data)) // 7天过期

      logger.info({ accountId, version }, 'Stored Claude Code headers')
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to store Claude Code headers')
    }
  }

  /**
   * 获取账户的 Claude Code headers
   * @param accountId - 账户 ID
   * @returns Claude Code headers
   */
  async getAccountHeaders(accountId: string): Promise<Record<string, string>> {
    try {
      const key = `claude_code_headers:${accountId}`
      const data = await this.redis.get(key)

      if (data) {
        const parsed: StoredHeaders = JSON.parse(data)
        logger.debug({
          accountId,
          version: parsed.version
        }, 'Retrieved Claude Code headers')
        return parsed.headers
      }

      // 返回默认 headers
      logger.debug({ accountId }, 'Using default Claude Code headers')
      return { ...DEFAULT_CLAUDE_CODE_HEADERS }
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to get Claude Code headers')
      return { ...DEFAULT_CLAUDE_CODE_HEADERS }
    }
  }

  /**
   * 清除账户的 Claude Code headers
   * @param accountId - 账户 ID
   */
  async clearAccountHeaders(accountId: string): Promise<void> {
    try {
      const key = `claude_code_headers:${accountId}`
      await this.redis.del(key)
      logger.info({ accountId }, 'Cleared Claude Code headers')
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to clear Claude Code headers')
    }
  }

  /**
   * 获取所有账户的 headers 信息
   * @returns 所有账户 headers
   */
  async getAllAccountHeaders(): Promise<Record<string, StoredHeaders>> {
    try {
      const pattern = 'claude_code_headers:*'
      const keys = await this.redis.keys(pattern)

      const results: Record<string, StoredHeaders> = {}
      for (const key of keys) {
        const accountId = key.replace('claude_code_headers:', '')
        const data = await this.redis.get(key)
        if (data) {
          results[accountId] = JSON.parse(data)
        }
      }

      return results
    } catch (error) {
      logger.error({ error }, 'Failed to get all account headers')
      return {}
    }
  }

  /**
   * 从客户端 headers 中提取 Claude Code 相关的 headers
   * @param clientHeaders - 客户端 headers
   * @returns 提取的 headers
   */
  private extractClaudeCodeHeaders(
    clientHeaders: Record<string, string | string[] | undefined>
  ): Record<string, string> {
    const headers: Record<string, string> = {}

    // 转换所有 header keys 为小写进行比较
    const lowerCaseHeaders: Record<string, string> = {}
    Object.keys(clientHeaders || {}).forEach((key) => {
      const value = clientHeaders[key]
      const stringValue = Array.isArray(value) ? value[0] || '' : value || ''
      lowerCaseHeaders[key.toLowerCase()] = stringValue
    })

    // 提取需要的 headers
    CLAUDE_CODE_REQUIRED_HEADERS.forEach((key) => {
      const lowerKey = key.toLowerCase()
      if (lowerCaseHeaders[lowerKey]) {
        headers[key] = lowerCaseHeaders[lowerKey]
      }
    })

    return headers
  }

  /**
   * 从 user-agent 中提取版本号
   * @param userAgent - User-Agent 字符串
   * @returns 版本号或 null
   */
  private extractVersionFromUserAgent(userAgent: string): string | null {
    if (!userAgent) return null

    const match = userAgent.match(/claude-cli\/([\d.]+(?:[a-zA-Z0-9-]*)?)/i)
    return match ? match[1] : null
  }

  /**
   * 比较版本号
   * @param v1 - 版本号1
   * @param v2 - 版本号2
   * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    if (!v1 || !v2) return 0

    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0
      const p2 = parts2[i] || 0

      if (p1 > p2) return 1
      if (p1 < p2) return -1
    }

    return 0
  }
}
