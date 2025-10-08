/**
 * API 转发相关类型定义
 * 对应 v1 的 claudeConsoleRelayService
 */

/**
 * 转发选项
 */
export interface RelayOptions {
  customPath?: string // 自定义路径（如 /v1/messages/count_tokens）
  betaHeader?: string // anthropic-beta 头
  timeout?: number // 超时时间（毫秒）
}

/**
 * 转发响应
 */
export interface RelayResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
  accountId: string
}

/**
 * Usage 数据（4 种 token）
 */
export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  cache_creation?: {
    ephemeral_5m_input_tokens: number
    ephemeral_1h_input_tokens: number
  }
  model: string
  accountId: string
}

/**
 * 流转换器函数
 */
export type StreamTransformer = (chunk: string) => string | null

/**
 * Usage 回调函数
 */
export type UsageCallback = (usage: Usage) => void

/**
 * 请求认证方式
 */
export type AuthMethod = 'x-api-key' | 'bearer'

/**
 * 获取认证方式
 */
export function getAuthMethod(apiKey: string): AuthMethod {
  return apiKey.startsWith('sk-ant-') ? 'x-api-key' : 'bearer'
}
