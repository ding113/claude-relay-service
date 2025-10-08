/**
 * 客户端验证相关类型
 * 对应 v1 的 claudeCodeValidator 和 codexCliValidator
 */

/**
 * 客户端类型
 */
export type ClientType = 'claude-code' | 'codex' | 'unknown'

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean
  clientType?: ClientType
  reason?: string
  version?: string | null // 客户端版本号
}

/**
 * Claude Code 必需 headers（13 个）
 */
export const CLAUDE_CODE_REQUIRED_HEADERS = [
  'x-stainless-retry-count',
  'x-stainless-timeout',
  'x-stainless-lang',
  'x-stainless-package-version',
  'x-stainless-os',
  'x-stainless-arch',
  'x-stainless-runtime',
  'x-stainless-runtime-version',
  'anthropic-dangerous-direct-browser-access',
  'x-app',
  'user-agent',
  'accept-language',
  'sec-fetch-mode'
] as const

/**
 * 默认 Claude Code headers
 */
export const DEFAULT_CLAUDE_CODE_HEADERS: Record<string, string> = {
  'x-stainless-retry-count': '0',
  'x-stainless-timeout': '60',
  'x-stainless-lang': 'js',
  'x-stainless-package-version': '0.55.1',
  'x-stainless-os': 'Windows',
  'x-stainless-arch': 'x64',
  'x-stainless-runtime': 'node',
  'x-stainless-runtime-version': 'v20.19.2',
  'anthropic-dangerous-direct-browser-access': 'true',
  'x-app': 'cli',
  'user-agent': 'claude-cli/1.0.57 (external, cli)',
  'accept-language': '*',
  'sec-fetch-mode': 'cors'
}

/**
 * Claude Code User-Agent 正则
 */
export const CLAUDE_CODE_UA_PATTERN =
  /^claude-cli\/[\d.]+(?:[-\w]*)?\s+\(external,\s*(?:cli|claude-[\w-]+|sdk-[\w-]+)\)$/i

/**
 * Codex User-Agent 正则
 */
export const CODEX_UA_PATTERN = /^(codex_vscode|codex_cli_rs)\/[\d.]+/i

/**
 * Claude Code metadata.user_id 正则
 */
export const CLAUDE_CODE_USER_ID_PATTERN = /^user_[a-fA-F0-9]{64}_account__session_[\w-]+$/

/**
 * Codex instructions 前缀
 */
export const CODEX_INSTRUCTIONS_PREFIX =
  'You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI'

/**
 * 系统提示词相似度阈值
 */
export const SYSTEM_PROMPT_THRESHOLD = 0.8
