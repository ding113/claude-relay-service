/**
 * Relay Routes
 * API 转发路由
 * 对应 v1 的 POST /v1/messages
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import type { AccountPlatform } from '@/shared/types'
import { RetryHandler } from '@/modules/scheduler/retry'
import { UsageRepository } from '@/core/redis/repositories/usage.repository'
import { redisClient } from '@/core/redis/client'
import {
  ClientValidatorService,
  HeadersService,
  SessionHashService,
  RelayService
} from './services'
import logger from '@/core/logger'

/**
 * 获取请求头（规范化为 Record<string, string>）
 */
function getHeaders(request: FastifyRequest): Record<string, string | string[] | undefined> {
  const headers: Record<string, string | string[] | undefined> = {}

  for (const [key, value] of Object.entries(request.headers)) {
    headers[key] = value
  }

  return headers
}

/**
 * 转换 Usage 为 UsageData（格式转换）
 */
function convertUsageToUsageData(usage: any): any {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreateTokens: usage.cache_creation_input_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    ephemeral5mTokens: usage.cache_creation?.ephemeral_5m_input_tokens,
    ephemeral1hTokens: usage.cache_creation?.ephemeral_1h_input_tokens,
    model: usage.model
  }
}

/**
 * 判断是否为流式请求
 */
function isStreamingRequest(body: any): boolean {
  return body && body.stream === true
}

/**
 * 确定请求平台（Claude Console 或 Codex）
 */
function determinePlatform(clientType: 'claude-code' | 'codex' | null): AccountPlatform {
  if (clientType === 'codex') {
    return 'codex'
  }
  return 'claude-console'
}

export async function relayRoutes(fastify: FastifyInstance) {
  const redis = redisClient.getClient()
  const retryHandler = new RetryHandler(redis, 5) // 最多重试 5 次
  const usageRepo = new UsageRepository(redis)
  const clientValidator = new ClientValidatorService()
  const headersService = new HeadersService(redis)
  const sessionHashService = new SessionHashService()
  const relayService = new RelayService()

  /**
   * POST /api/v1/messages
   * Claude API 转发端点（v1 兼容）
   */
  fastify.post('/api/v1/messages', {
    schema: {
      description: 'Forward Claude API requests with automatic account selection and retry',
      tags: ['Relay'],
      summary: 'Forward Message Request',
      body: {
        type: 'object',
        properties: {
          model: { type: 'string' },
          messages: { type: 'array' },
          stream: { type: 'boolean' },
          max_tokens: { type: 'number' },
          temperature: { type: 'number' },
          system: {
            oneOf: [
              { type: 'string' },
              { type: 'array' }
            ]
          },
          metadata: { type: 'object' }
        },
        required: ['model', 'messages']
      },
      response: {
        200: {
          description: 'Request forwarded successfully'
        },
        400: {
          description: 'Invalid request',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        403: {
          description: 'Client validation failed',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        503: {
          description: 'No available accounts',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const requestBody = request.body as any
    const headers = getHeaders(request)
    const path = request.url

    try {
      // 1. 客户端验证（Claude Code 或 Codex）
      const claudeCodeValidation = clientValidator.validateClaudeCode(headers, requestBody, path)
      const codexValidation = clientValidator.validateCodex(headers, requestBody, path)

      let clientType: 'claude-code' | 'codex' | null = null

      if (claudeCodeValidation.valid) {
        clientType = 'claude-code'
        logger.debug({
          clientType,
          version: claudeCodeValidation.version
        }, 'Client validated')
      } else if (codexValidation.valid) {
        clientType = 'codex'
        logger.debug({
          clientType,
          version: codexValidation.version
        }, 'Client validated')
      } else {
        logger.warn({
          claudeCodeReason: claudeCodeValidation.reason,
          codexReason: codexValidation.reason
        }, 'Client validation failed')

        return reply.code(403).send({
          error: 'Client validation failed. Only Claude Code and Codex clients are allowed.'
        })
      }

      // 2. 生成会话哈希（Sticky Session）
      const sessionHash = sessionHashService.generateSessionHash(requestBody)

      // 3. 确定平台
      const platform = determinePlatform(clientType)

      // 4. 选择账户（带重试）
      const excludeIds = new Set<string>()
      let scheduleResult: any = null
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          scheduleResult = await retryHandler.selectWithRetry({
            platform,
            model: requestBody.model,
            sessionHash: sessionHash || undefined
          }, {
            excludeIds,
            maxRetries: 1 // 每次只尝试一次，外层循环控制重试
          })

          logger.info({
            attempt,
            accountId: scheduleResult.account.id,
            accountName: scheduleResult.account.name,
            isSticky: scheduleResult.isSticky
          }, 'Account selected')

          break // 成功选择账户，跳出循环
        } catch (error) {
          lastError = error as Error
          logger.warn({ attempt, error: lastError.message }, 'Account selection failed')
        }
      }

      if (!scheduleResult) {
        logger.error({ lastError }, 'All account selection attempts failed')
        return reply.code(503).send({
          error: 'No available accounts for this request'
        })
      }

      const selectedAccount = scheduleResult.account

      // 5. 存储 Claude Code headers（如果是 Claude Code 客户端）
      if (clientType === 'claude-code') {
        await headersService.storeAccountHeaders(selectedAccount.id, headers)
      }

      // 6. 转发请求（流式或非流式）
      const isStreaming = isStreamingRequest(requestBody)

      if (isStreaming) {
        // 流式请求
        try {
          const { stream, onUsage } = await relayService.relayStreaming(
            selectedAccount,
            requestBody,
            headers
          )

          // 注册 usage 回调
          onUsage(async (usage) => {
            try {
              const usageData = convertUsageToUsageData(usage)
              await usageRepo.incrementUsage(selectedAccount.id, usageData)
              logger.info({ usage }, 'Usage recorded')
            } catch (error) {
              logger.error({ error }, 'Failed to record usage')
            }
          })

          // 如果请求已经重试过，从排除列表中移除失败的账户
          if (excludeIds.size > 0) {
            logger.info({
              accountId: selectedAccount.id,
              previousFailures: Array.from(excludeIds)
            }, 'Streaming request succeeded after retry')
          }

          // 设置响应头
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          })

          // 管道传输
          stream.pipe(reply.raw)

          // 错误处理
          stream.on('error', (error) => {
            logger.error({ accountId: selectedAccount.id, error }, 'Stream error')
            excludeIds.add(selectedAccount.id)
            reply.raw.end()
          })

          stream.on('end', () => {
            logger.debug({ accountId: selectedAccount.id }, 'Stream ended')
          })
        } catch (error) {
          // 流式转发失败，重试
          excludeIds.add(selectedAccount.id)
          logger.error({
            accountId: selectedAccount.id,
            error
          }, 'Streaming relay failed, should retry')

          return reply.code(500).send({
            error: 'Request failed'
          })
        }
      } else {
        // 非流式请求
        try {
          const { response, usage } = await relayService.relayNonStreaming(
            selectedAccount,
            requestBody,
            headers
          )

          // 记录 usage
          if (usage) {
            const usageData = convertUsageToUsageData(usage)
            await usageRepo.incrementUsage(selectedAccount.id, usageData)
            logger.info({ usage }, 'Usage recorded')
          }

          // 如果请求已经重试过，从排除列表中移除失败的账户
          if (excludeIds.size > 0) {
            logger.info({
              accountId: selectedAccount.id,
              previousFailures: Array.from(excludeIds)
            }, 'Non-streaming request succeeded after retry')
          }

          return reply.code(200).send(response)
        } catch (error) {
          // 非流式转发失败，重试
          excludeIds.add(selectedAccount.id)
          logger.error({
            accountId: selectedAccount.id,
            error
          }, 'Non-streaming relay failed, should retry')

          return reply.code(500).send({
            error: 'Request failed'
          })
        }
      }
    } catch (error) {
      logger.error({ error }, 'Relay request failed')

      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}

export default fp(relayRoutes)
