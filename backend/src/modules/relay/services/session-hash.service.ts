/**
 * Session Hash Service
 * 会话哈希生成服务 - 用于 Sticky Session
 * 对应 v1 的 sessionHelper
 */

import crypto from 'crypto'
import logger from '@/core/logger'

export class SessionHashService {
  /**
   * 生成会话哈希，用于 sticky 会话保持
   * 基于 Anthropic 的 prompt caching 机制，优先使用 metadata 中的 session ID
   * @param requestBody - 请求体
   * @returns 32/36 字符的会话哈希，如果无法生成则返回 null
   */
  generateSessionHash(requestBody: any): string | null {
    if (!requestBody || typeof requestBody !== 'object') {
      return null
    }

    // 1. 最高优先级：使用 metadata 中的 session ID（直接使用，无需 hash）
    const sessionFromMetadata = this.extractFromMetadata(requestBody.metadata)
    if (sessionFromMetadata) {
      logger.debug({ session: sessionFromMetadata }, 'Session hash from metadata.user_id')
      return sessionFromMetadata
    }

    // 2. 提取带有 cache_control: {"type": "ephemeral"} 的内容
    const cacheableContent = this.extractFromCacheableContent(requestBody)
    if (cacheableContent) {
      const hash = this.hashContent(cacheableContent)
      logger.debug({ hash }, 'Session hash from cacheable content')
      return hash
    }

    // 3. Fallback: 使用 system 内容
    const systemContent = this.extractFromSystemContent(requestBody.system)
    if (systemContent) {
      const hash = this.hashContent(systemContent)
      logger.debug({ hash }, 'Session hash from system content')
      return hash
    }

    // 4. 最后 fallback: 使用第一条消息内容
    const firstMessageContent = this.extractFromFirstMessage(requestBody.messages || [])
    if (firstMessageContent) {
      const hash = this.hashContent(firstMessageContent)
      logger.debug({ hash }, 'Session hash from first message')
      return hash
    }

    // 无法生成会话哈希
    logger.debug('Unable to generate session hash - no suitable content found')
    return null
  }

  /**
   * 从 metadata 中提取 session ID
   * @param metadata - metadata 对象
   * @returns session UUID 或 null
   */
  private extractFromMetadata(metadata: any): string | null {
    if (!metadata || !metadata.user_id) {
      return null
    }

    // 提取 session_xxx 部分
    // 格式: user_{64位hash}_account__session_{uuid}
    const userIdString = metadata.user_id
    const sessionMatch = userIdString.match(/session_([a-f0-9-]{36})/)

    if (sessionMatch && sessionMatch[1]) {
      const sessionId = sessionMatch[1]
      return sessionId // 直接返回 UUID，不 hash
    }

    return null
  }

  /**
   * 从 cacheable content 中提取内容
   * @param body - 请求体
   * @returns cacheable 内容或 null
   */
  private extractFromCacheableContent(body: any): string | null {
    let cacheableContent = ''
    const system = body.system || ''
    const messages = body.messages || []

    // 检查 system 中的 cacheable 内容
    if (Array.isArray(system)) {
      for (const part of system) {
        if (part && part.cache_control && part.cache_control.type === 'ephemeral') {
          cacheableContent += part.text || ''
        }
      }
    }

    // 检查 messages 中的 cacheable 内容
    for (const msg of messages) {
      const content = msg.content || ''
      let hasCacheControl = false

      if (Array.isArray(content)) {
        for (const part of content) {
          if (part && part.cache_control && part.cache_control.type === 'ephemeral') {
            hasCacheControl = true
            break
          }
        }
      } else if (
        typeof content === 'string' &&
        msg.cache_control &&
        msg.cache_control.type === 'ephemeral'
      ) {
        hasCacheControl = true
      }

      if (hasCacheControl) {
        // 提取所有消息的文本内容
        for (const message of messages) {
          let messageText = ''
          if (typeof message.content === 'string') {
            messageText = message.content
          } else if (Array.isArray(message.content)) {
            messageText = message.content
              .filter((part: any) => part.type === 'text')
              .map((part: any) => part.text || '')
              .join('')
          }

          if (messageText) {
            cacheableContent += messageText
            break
          }
        }
        break
      }
    }

    return cacheableContent || null
  }

  /**
   * 从 system 内容中提取文本
   * @param system - system 字段
   * @returns system 文本或 null
   */
  private extractFromSystemContent(system: any): string | null {
    if (!system) {
      return null
    }

    let systemText = ''

    if (typeof system === 'string') {
      systemText = system
    } else if (Array.isArray(system)) {
      systemText = system.map((part: any) => part.text || '').join('')
    }

    return systemText || null
  }

  /**
   * 从第一条消息中提取文本
   * @param messages - 消息数组
   * @returns 第一条消息文本或 null
   */
  private extractFromFirstMessage(messages: any[]): string | null {
    if (!messages || messages.length === 0) {
      return null
    }

    const firstMessage = messages[0]
    let firstMessageText = ''

    if (typeof firstMessage.content === 'string') {
      firstMessageText = firstMessage.content
    } else if (Array.isArray(firstMessage.content)) {
      if (!firstMessage.content) {
        logger.error({ firstMessage }, 'First message content is undefined')
        return null
      }

      firstMessageText = firstMessage.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text || '')
        .join('')
    }

    return firstMessageText || null
  }

  /**
   * 对内容进行 SHA256 哈希（前 32 位）
   * @param content - 内容
   * @returns 32 字符哈希
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32)
  }

  /**
   * 验证会话哈希格式
   * @param sessionHash - 会话哈希
   * @returns 是否有效
   */
  validateSessionHash(sessionHash: string): boolean {
    if (!sessionHash || typeof sessionHash !== 'string') {
      return false
    }

    // 32 字符哈希（SHA256）
    if (sessionHash.length === 32 && /^[a-f0-9]{32}$/.test(sessionHash)) {
      return true
    }

    // 36 字符 UUID（来自 metadata）
    if (sessionHash.length === 36 && /^[a-f0-9-]{36}$/.test(sessionHash)) {
      return true
    }

    return false
  }

  /**
   * 获取会话的 Redis 键名
   * @param sessionHash - 会话哈希
   * @returns Redis 键名
   */
  getSessionRedisKey(sessionHash: string): string {
    return `sticky_session:${sessionHash}`
  }
}
