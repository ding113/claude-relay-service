/**
 * Usage Capture Service
 * SSE 解析和 Usage 数据提取服务
 * 对应 v1 的 claudeConsoleRelayService 中的 SSE 解析逻辑
 */

import { Transform } from 'stream'
import type { Usage } from '@/shared/types/relay'
import type { MessageStartData, MessageDeltaData, SSEEvent } from '@/shared/types/usage-capture'
import logger from '@/core/logger'

export class UsageCaptureService {
  /**
   * 创建流式转换器，用于解析 SSE 并提取 Usage
   * @param onUsageExtracted - Usage 提取完成后的回调
   * @param model - 模型名称
   * @param accountId - 账户 ID
   * @returns Transform stream
   */
  createStreamTransformer(
    onUsageExtracted: (usage: Usage) => void,
    model: string,
    accountId: string
  ): Transform {
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0
    let cacheCreationTokens = 0
    let cacheReadTokens = 0
    let ephemeral5mTokens = 0
    let ephemeral1hTokens = 0
    let usageExtracted = false

    return new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        // 将 chunk 添加到 buffer
        buffer += chunk.toString()

        // 解析 message_start 事件（仅需一次）
        if (!usageExtracted) {
          const messageStartMatch = buffer.match(/^event: message_start\r?\ndata: (.*)\r?\n\r?\n/m)
          if (messageStartMatch) {
            try {
              const data: MessageStartData = JSON.parse(messageStartMatch[1])
              inputTokens = data.message.usage.input_tokens || 0
              cacheCreationTokens = data.message.usage.cache_creation_input_tokens || 0
              cacheReadTokens = data.message.usage.cache_read_input_tokens || 0

              // 提取详细缓存数据
              if (data.message.usage.cache_creation) {
                ephemeral5mTokens = data.message.usage.cache_creation.ephemeral_5m_input_tokens || 0
                ephemeral1hTokens = data.message.usage.cache_creation.ephemeral_1h_input_tokens || 0
              }

              logger.debug({
                inputTokens,
                cacheCreationTokens,
                cacheReadTokens,
                ephemeral5mTokens,
                ephemeral1hTokens
              }, 'Extracted input tokens from message_start')
            } catch (error) {
              logger.warn({ error, data: messageStartMatch[1] }, 'Failed to parse message_start data')
            }
          }
        }

        // 解析 message_delta 事件（可能多次，取最后一次）
        const messageDeltaMatches = buffer.matchAll(/event: message_delta\r?\ndata: (.*)\r?\n\r?\n/gm)
        for (const match of messageDeltaMatches) {
          try {
            const data: MessageDeltaData = JSON.parse(match[1])
            if (data.usage?.output_tokens !== undefined) {
              outputTokens = data.usage.output_tokens
              logger.debug({ outputTokens }, 'Extracted output tokens from message_delta')
            }
          } catch (error) {
            logger.warn({ error, data: match[1] }, 'Failed to parse message_delta data')
          }
        }

        // 检查是否有 message_stop 事件，表示流结束
        if (buffer.includes('event: message_stop') && !usageExtracted) {
          usageExtracted = true

          // 构建 Usage 对象
          const usage: Usage = {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_creation_input_tokens: cacheCreationTokens,
            cache_read_input_tokens: cacheReadTokens,
            model,
            accountId
          }

          // 如果有详细缓存数据，添加 cache_creation 字段
          if (ephemeral5mTokens > 0 || ephemeral1hTokens > 0) {
            usage.cache_creation = {
              ephemeral_5m_input_tokens: ephemeral5mTokens,
              ephemeral_1h_input_tokens: ephemeral1hTokens
            }
          }

          logger.info({ usage }, 'Usage extraction completed')

          // 调用回调
          onUsageExtracted(usage)
        }

        // 将原始 chunk 传递下去（不修改响应内容）
        this.push(chunk)
        callback()
      }
    })
  }

  /**
   * 从 SSE 事件数组中提取 Usage（用于测试）
   * @param events - SSE 事件数组
   * @param model - 模型名称
   * @param accountId - 账户 ID
   * @returns Usage 对象或 null
   */
  extractUsageFromEvents(
    events: SSEEvent[],
    model: string,
    accountId: string
  ): Usage | null {
    let inputTokens = 0
    let outputTokens = 0
    let cacheCreationTokens = 0
    let cacheReadTokens = 0
    let ephemeral5mTokens = 0
    let ephemeral1hTokens = 0

    for (const event of events) {
      if (event.event === 'message_start' && event.data) {
        try {
          const data: MessageStartData = JSON.parse(event.data)
          inputTokens = data.message.usage.input_tokens || 0
          cacheCreationTokens = data.message.usage.cache_creation_input_tokens || 0
          cacheReadTokens = data.message.usage.cache_read_input_tokens || 0

          if (data.message.usage.cache_creation) {
            ephemeral5mTokens = data.message.usage.cache_creation.ephemeral_5m_input_tokens || 0
            ephemeral1hTokens = data.message.usage.cache_creation.ephemeral_1h_input_tokens || 0
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to parse message_start data')
        }
      }

      if (event.event === 'message_delta' && event.data) {
        try {
          const data: MessageDeltaData = JSON.parse(event.data)
          if (data.usage?.output_tokens !== undefined) {
            outputTokens = data.usage.output_tokens
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to parse message_delta data')
        }
      }
    }

    // 如果没有提取到任何数据，返回 null
    if (inputTokens === 0 && outputTokens === 0) {
      return null
    }

    // 构建 Usage 对象
    const usage: Usage = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationTokens,
      cache_read_input_tokens: cacheReadTokens,
      model,
      accountId
    }

    if (ephemeral5mTokens > 0 || ephemeral1hTokens > 0) {
      usage.cache_creation = {
        ephemeral_5m_input_tokens: ephemeral5mTokens,
        ephemeral_1h_input_tokens: ephemeral1hTokens
      }
    }

    return usage
  }

  /**
   * 解析单行 SSE（工具方法）
   * @param line - SSE 行
   * @returns SSE 事件对象或 null
   */
  parseSSELine(line: string): SSEEvent | null {
    if (!line || line.trim() === '') {
      return null
    }

    if (line.startsWith('event:')) {
      const event = line.substring(6).trim()
      return { event }
    }

    if (line.startsWith('data:')) {
      const data = line.substring(5).trim()
      return { data }
    }

    return null
  }

  /**
   * 解析 SSE 文本块（工具方法）
   * @param text - SSE 文本
   * @returns SSE 事件数组
   */
  parseSSEText(text: string): SSEEvent[] {
    const events: SSEEvent[] = []
    const lines = text.split(/\r?\n/)
    let currentEvent: Partial<SSEEvent> = {}

    for (const line of lines) {
      if (line.trim() === '') {
        // 空行表示事件结束
        if (currentEvent.event || currentEvent.data) {
          events.push(currentEvent as SSEEvent)
          currentEvent = {}
        }
        continue
      }

      if (line.startsWith('event:')) {
        currentEvent.event = line.substring(6).trim()
      } else if (line.startsWith('data:')) {
        currentEvent.data = line.substring(5).trim()
      }
    }

    // 最后一个事件（如果没有空行结尾）
    if (currentEvent.event || currentEvent.data) {
      events.push(currentEvent as SSEEvent)
    }

    return events
  }
}
