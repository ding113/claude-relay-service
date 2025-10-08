/**
 * Client Validator Service
 * 客户端验证服务 - 验证 Claude Code 和 Codex 客户端
 * 对应 v1 的 claudeCodeValidator 和 codexCliValidator
 */

import logger from '@/core/logger'
import type {
  ValidationResult
} from '@/shared/types/client-validator'
import {
  CLAUDE_CODE_UA_PATTERN,
  CODEX_UA_PATTERN,
  CLAUDE_CODE_USER_ID_PATTERN,
  CODEX_INSTRUCTIONS_PREFIX,
  SYSTEM_PROMPT_THRESHOLD
} from '@/shared/types/client-validator'

export class ClientValidatorService {
  /**
   * 验证 Claude Code 客户端
   * @param headers - 请求 headers
   * @param body - 请求 body
   * @param path - 请求路径
   * @returns 验证结果
   */
  validateClaudeCode(
    headers: Record<string, string | string[] | undefined>,
    body: any,
    path?: string
  ): ValidationResult {
    try {
      const userAgent = this.getHeader(headers, 'user-agent')

      // 1. 检查 User-Agent
      if (!CLAUDE_CODE_UA_PATTERN.test(userAgent)) {
        return {
          valid: false,
          clientType: 'unknown',
          reason: 'Invalid Claude Code User-Agent'
        }
      }

      // 提取版本号
      const version = this.extractVersionFromUserAgent(userAgent)

      // 2. 对于非 /messages 路径，只要 UA 匹配就认为是 Claude Code
      if (!path || !path.includes('messages')) {
        logger.debug({ path }, 'Claude Code detected for non-messages path')
        return {
          valid: true,
          clientType: 'claude-code',
          version
        }
      }

      // 3. 检查系统提示词
      if (!this.hasClaudeCodeSystemPrompt(body)) {
        return {
          valid: false,
          clientType: 'claude-code',
          reason: 'Missing or invalid Claude Code system prompt'
        }
      }

      // 4. 检查必需的 headers
      const xApp = this.getHeader(headers, 'x-app')
      const anthropicBeta = this.getHeader(headers, 'anthropic-beta')
      const anthropicVersion = this.getHeader(headers, 'anthropic-version')

      if (!xApp || xApp.trim() === '') {
        return {
          valid: false,
          clientType: 'claude-code',
          reason: 'Missing or empty x-app header'
        }
      }

      if (!anthropicBeta || anthropicBeta.trim() === '') {
        return {
          valid: false,
          clientType: 'claude-code',
          reason: 'Missing or empty anthropic-beta header'
        }
      }

      if (!anthropicVersion || anthropicVersion.trim() === '') {
        return {
          valid: false,
          clientType: 'claude-code',
          reason: 'Missing or empty anthropic-version header'
        }
      }

      // 5. 验证 metadata.user_id
      if (!body?.metadata?.user_id) {
        return {
          valid: false,
          clientType: 'claude-code',
          reason: 'Missing metadata.user_id in body'
        }
      }

      const userId = body.metadata.user_id
      if (!CLAUDE_CODE_USER_ID_PATTERN.test(userId)) {
        return {
          valid: false,
          clientType: 'claude-code',
          reason: `Invalid user_id format: ${userId}`
        }
      }

      logger.debug({
        userAgent,
        userId,
        xApp,
        anthropicBeta
      }, 'Claude Code validation passed')

      return {
        valid: true,
        clientType: 'claude-code',
        version
      }
    } catch (error) {
      logger.error({ error }, 'Error in validateClaudeCode')
      return {
        valid: false,
        clientType: 'unknown',
        reason: 'Validation error'
      }
    }
  }

  /**
   * 验证 Codex 客户端
   * @param headers - 请求 headers
   * @param body - 请求 body
   * @param path - 请求路径
   * @returns 验证结果
   */
  validateCodex(
    headers: Record<string, string | string[] | undefined>,
    body: any,
    path?: string
  ): ValidationResult {
    try {
      const userAgent = this.getHeader(headers, 'user-agent')
      const originator = this.getHeader(headers, 'originator')
      const sessionId = this.getHeader(headers, 'session_id')

      // 1. 基础 User-Agent 检查
      const uaMatch = userAgent.match(CODEX_UA_PATTERN)
      if (!uaMatch) {
        return {
          valid: false,
          clientType: 'unknown',
          reason: 'Invalid Codex User-Agent'
        }
      }

      // 提取客户端类型
      const clientType = uaMatch[1].toLowerCase()

      // 2. 对于非严格验证路径，只要 UA 匹配就认为是 Codex
      const strictValidationPaths = ['/openai', '/azure']
      const needsStrictValidation = path && strictValidationPaths.some(p => path.startsWith(p))

      if (!needsStrictValidation) {
        logger.debug({ path }, 'Codex detected for non-strict path')
        return {
          valid: true,
          clientType: 'codex'
        }
      }

      // 3. 验证 originator 头必须与 UA 中的客户端类型匹配
      if (originator.toLowerCase() !== clientType) {
        return {
          valid: false,
          clientType: 'codex',
          reason: `Originator mismatch. UA: ${clientType}, originator: ${originator}`
        }
      }

      // 4. 检查 session_id - 必须存在且长度大于20
      if (!sessionId || sessionId.length <= 20) {
        return {
          valid: false,
          clientType: 'codex',
          reason: `session_id missing or too short: ${sessionId}`
        }
      }

      // 5. 对于 /openai/responses 和 /azure/response 路径，检查 instructions
      if (
        path &&
        (path.includes('/openai/responses') || path.includes('/azure/response'))
      ) {
        if (!body?.instructions) {
          return {
            valid: false,
            clientType: 'codex',
            reason: `Missing instructions in body for ${path}`
          }
        }

        if (!body.instructions.startsWith(CODEX_INSTRUCTIONS_PREFIX)) {
          return {
            valid: false,
            clientType: 'codex',
            reason: 'Invalid instructions prefix'
          }
        }

        // 检查 model 字段
        if (body.model && body.model !== 'gpt-5-codex') {
          logger.debug({ model: body.model }, 'Codex model mismatch (warning only)')
        }
      }

      logger.debug({ userAgent }, 'Codex validation passed')

      return {
        valid: true,
        clientType: 'codex'
      }
    } catch (error) {
      logger.error({ error }, 'Error in validateCodex')
      return {
        valid: false,
        clientType: 'unknown',
        reason: 'Validation error'
      }
    }
  }

  /**
   * 检查是否包含 Claude Code 系统提示词
   * @param body - 请求 body
   * @returns 是否包含
   */
  private hasClaudeCodeSystemPrompt(body: any): boolean {
    if (!body || typeof body !== 'object') {
      return false
    }

    const model = typeof body.model === 'string' ? body.model : null
    if (!model) {
      return false
    }

    const systemEntries = Array.isArray(body.system) ? body.system : []
    for (const entry of systemEntries) {
      const rawText = typeof entry?.text === 'string' ? entry.text : ''
      const similarity = this.calculateSimilarity(rawText)

      if (similarity < SYSTEM_PROMPT_THRESHOLD) {
        logger.error({
          score: similarity.toFixed(4),
          threshold: SYSTEM_PROMPT_THRESHOLD,
          promptPreview: rawText.substring(0, 100)
        }, 'Claude system prompt similarity below threshold')
        return false
      }
    }

    return true
  }

  /**
   * 计算系统提示词相似度（简化版）
   * v1 使用复杂的模板匹配，这里简化为关键词检测
   * @param text - 提示词文本
   * @returns 相似度分数
   */
  private calculateSimilarity(text: string): number {
    if (!text) return 0

    // Claude Code 系统提示词的关键特征
    const keywords = [
      'You are Claude Code',
      'coding assistant',
      'Anthropic',
      'tools you can use'
    ]

    let matchCount = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        matchCount++
      }
    }

    return matchCount / keywords.length
  }

  /**
   * 从 User-Agent 中提取版本号
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
  compareVersions(v1: string, v2: string): number {
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

  /**
   * 获取 header 值（不区分大小写）
   * @param headers - headers 对象
   * @param key - header key
   * @returns header 值
   */
  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string
  ): string {
    const lowerKey = key.toLowerCase()

    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lowerKey) {
        return Array.isArray(v) ? v[0] || '' : v || ''
      }
    }

    return ''
  }
}
