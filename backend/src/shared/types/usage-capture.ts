/**
 * Usage 捕获相关类型
 * 对应 v1 的流式 SSE 解析逻辑
 */

/**
 * SSE 事件类型
 */
export type SSEEventType =
  | 'message_start'
  | 'message_delta'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_stop'
  | 'ping'
  | 'error'

/**
 * SSE 行
 */
export interface SSELine {
  type: 'event' | 'data' | 'comment' | 'empty'
  content: string
}

/**
 * SSE 事件（简化版，用于 UsageCaptureService）
 */
export interface SSEEvent {
  event?: string
  data?: string
}

/**
 * message_start 事件数据
 */
export interface MessageStartData {
  type: 'message_start'
  message: {
    id: string
    type: string
    role: string
    content: any[]
    model: string
    stop_reason: string | null
    stop_sequence: string | null
    usage: {
      input_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
      cache_creation?: {
        ephemeral_5m_input_tokens?: number
        ephemeral_1h_input_tokens?: number
      }
    }
  }
}

/**
 * message_delta 事件数据
 */
export interface MessageDeltaData {
  type: 'message_delta'
  delta: {
    stop_reason?: string
    stop_sequence?: string | null
  }
  usage?: {
    output_tokens: number
  }
}

/**
 * 收集的 Usage 数据
 */
export interface CollectedUsage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: {
    ephemeral_5m_input_tokens: number
    ephemeral_1h_input_tokens: number
  }
  model?: string
}

/**
 * 检查 Usage 是否完整
 */
export function isUsageComplete(usage: CollectedUsage): boolean {
  return (
    usage.input_tokens !== undefined &&
    usage.output_tokens !== undefined
  )
}

/**
 * 解析 SSE 行
 */
export function parseSSELine(line: string): SSELine | null {
  if (line.trim() === '') {
    return { type: 'empty', content: '' }
  }

  if (line.startsWith(':')) {
    return { type: 'comment', content: line.slice(1).trim() }
  }

  if (line.startsWith('event:')) {
    return { type: 'event', content: line.slice(6).trim() }
  }

  if (line.startsWith('data:')) {
    return { type: 'data', content: line.slice(5).trim() }
  }

  return null
}
