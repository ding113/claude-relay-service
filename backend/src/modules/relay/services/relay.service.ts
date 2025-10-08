/**
 * Relay Service
 * Claude Console API 转发核心服务
 * 对应 v1 的 claudeConsoleRelayService.js
 */

import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { Readable } from 'stream'
import type { Account } from '@/shared/types/account'
import type { Usage, RelayOptions } from '@/shared/types/relay'
import { AccountRepository } from '@/core/redis/repositories/account.repository'
import { redisClient } from '@/core/redis/client'
import { HeadersService } from './headers.service'
import { ProxyAgentService } from './proxy-agent.service'
import { UsageCaptureService } from './usage-capture.service'
import logger from '@/core/logger'

/**
 * 需要从客户端请求中过滤掉的敏感 headers
 */
const FILTERED_HEADERS = [
  'authorization',
  'x-api-key',
  'cookie',
  'anthropic-version',
  'anthropic-beta',
  'anthropic-client-id',
  'x-claude-trace-id',
  'x-request-id',
  'referer',
  'origin',
  'host'
]

/**
 * 默认 Beta header（完全复制 v1）
 */
const DEFAULT_BETA_HEADER =
  'oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'

export class RelayService {
  private accountRepo: AccountRepository
  private headersService: HeadersService
  private proxyService: ProxyAgentService
  private usageService: UsageCaptureService

  constructor(
    accountRepo?: AccountRepository,
    headersService?: HeadersService,
    proxyService?: ProxyAgentService,
    usageService?: UsageCaptureService
  ) {
    this.accountRepo = accountRepo || new AccountRepository(redisClient.getClient())
    this.headersService = headersService || new HeadersService()
    this.proxyService = proxyService || new ProxyAgentService()
    this.usageService = usageService || new UsageCaptureService()
  }

  /**
   * 转发非流式请求
   * @param account - 选中的账户
   * @param requestBody - 请求体
   * @param clientHeaders - 客户端 headers
   * @param options - 转发选项
   * @returns 响应数据
   */
  async relayNonStreaming(
    account: Account,
    requestBody: any,
    clientHeaders: Record<string, string | string[] | undefined>,
    options: RelayOptions = {}
  ): Promise<{ response: any; usage: Usage | null }> {
    try {
      // 应用模型映射
      const mappedBody = this.applyModelMapping(requestBody, account)

      // 构建 headers
      const headers = await this.buildHeaders(account, clientHeaders, options)

      // 构建请求 URL
      const url = this.buildRequestUrl(account, options)

      // 创建 axios 配置
      const axiosConfig: AxiosRequestConfig = {
        method: 'POST',
        url,
        headers,
        data: mappedBody,
        timeout: options.timeout || 300000, // 默认 5 分钟
        responseType: 'json',
        validateStatus: () => true // 不自动抛出错误
      }

      // 如果有代理配置，添加代理 agent
      if (account.proxy) {
        const proxyAgent = this.proxyService.createProxyAgent(account.proxy)
        if (proxyAgent) {
          axiosConfig.httpAgent = proxyAgent
          axiosConfig.httpsAgent = proxyAgent
        }
      }

      logger.debug({
        accountId: account.id,
        url,
        model: mappedBody.model
      }, 'Sending non-streaming request')

      // 发送请求
      const response = await axios(axiosConfig)

      // 更新账户最后使用时间
      await this.accountRepo.update(account.platform, account.id, {
        lastUsedAt: new Date().toISOString()
      })

      // 处理错误状态码
      if (response.status !== 200) {
        await this.handleErrorStatus(account, response)
        throw new Error(`Upstream returned ${response.status}: ${response.statusText}`)
      }

      // 提取 Usage
      const usage = this.extractUsageFromResponse(response.data, account)

      logger.info({
        accountId: account.id,
        status: response.status,
        usage
      }, 'Non-streaming request completed')

      return { response: response.data, usage }
    } catch (error) {
      logger.error({
        accountId: account.id,
        error
      }, 'Non-streaming request failed')
      throw error
    }
  }

  /**
   * 转发流式请求
   * @param account - 选中的账户
   * @param requestBody - 请求体
   * @param clientHeaders - 客户端 headers
   * @param options - 转发选项
   * @returns 流式响应和 usage 回调
   */
  async relayStreaming(
    account: Account,
    requestBody: any,
    clientHeaders: Record<string, string | string[] | undefined>,
    options: RelayOptions = {}
  ): Promise<{
    stream: Readable
    onUsage: (callback: (usage: Usage) => void) => void
  }> {
    try {
      // 应用模型映射
      const mappedBody = this.applyModelMapping(requestBody, account)

      // 构建 headers
      const headers = await this.buildHeaders(account, clientHeaders, options)

      // 构建请求 URL
      const url = this.buildRequestUrl(account, options)

      // 创建 axios 配置
      const axiosConfig: AxiosRequestConfig = {
        method: 'POST',
        url,
        headers,
        data: mappedBody,
        timeout: options.timeout || 300000,
        responseType: 'stream',
        validateStatus: () => true
      }

      // 如果有代理配置，添加代理 agent
      if (account.proxy) {
        const proxyAgent = this.proxyService.createProxyAgent(account.proxy)
        if (proxyAgent) {
          axiosConfig.httpAgent = proxyAgent
          axiosConfig.httpsAgent = proxyAgent
        }
      }

      logger.debug({
        accountId: account.id,
        url,
        model: mappedBody.model
      }, 'Sending streaming request')

      // 发送请求
      const response: AxiosResponse<Readable> = await axios(axiosConfig)

      // 更新账户最后使用时间
      await this.accountRepo.update(account.platform, account.id, {
        lastUsedAt: new Date().toISOString()
      })

      // 处理错误状态码
      if (response.status !== 200) {
        await this.handleErrorStatus(account, response)
        throw new Error(`Upstream returned ${response.status}: ${response.statusText}`)
      }

      // 创建 usage 回调容器
      let usageCallback: ((usage: Usage) => void) | null = null

      // 创建 usage 提取器
      const usageTransformer = this.usageService.createStreamTransformer(
        (usage: Usage) => {
          logger.info({ accountId: account.id, usage }, 'Streaming usage extracted')
          if (usageCallback) {
            usageCallback(usage)
          }
        },
        mappedBody.model,
        account.id
      )

      // 将上游流通过 usage 提取器传递
      const transformedStream = response.data.pipe(usageTransformer)

      // 错误处理
      response.data.on('error', (error) => {
        logger.error({ accountId: account.id, error }, 'Upstream stream error')
        transformedStream.destroy(error)
      })

      usageTransformer.on('error', (error) => {
        logger.error({ accountId: account.id, error }, 'Usage transformer error')
      })

      logger.info({ accountId: account.id }, 'Streaming request started')

      return {
        stream: transformedStream,
        onUsage: (callback) => {
          usageCallback = callback
        }
      }
    } catch (error) {
      logger.error({
        accountId: account.id,
        error
      }, 'Streaming request failed')
      throw error
    }
  }

  /**
   * 构建请求 headers
   * @param account - 账户
   * @param clientHeaders - 客户端 headers
   * @param options - 转发选项
   * @returns 构建的 headers
   */
  private async buildHeaders(
    account: Account,
    clientHeaders: Record<string, string | string[] | undefined>,
    options: RelayOptions
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}

    // 1. 过滤客户端 headers（移除敏感 headers）
    for (const [key, value] of Object.entries(clientHeaders)) {
      const lowerKey = key.toLowerCase()
      if (!FILTERED_HEADERS.includes(lowerKey)) {
        const stringValue = Array.isArray(value) ? value[0] || '' : value || ''
        if (stringValue) {
          headers[key] = stringValue
        }
      }
    }

    // 2. 添加 Claude Code headers（如果有）
    const claudeCodeHeaders = await this.headersService.getAccountHeaders(account.id)
    for (const [key, value] of Object.entries(claudeCodeHeaders)) {
      headers[key] = value
    }

    // 3. 添加认证 header
    if (account.apiKey.startsWith('sk-ant-')) {
      // 官方 API Key 使用 x-api-key
      headers['x-api-key'] = account.apiKey
    } else {
      // 其他使用 Bearer
      headers['Authorization'] = `Bearer ${account.apiKey}`
    }

    // 4. 添加 anthropic-version（固定值）
    headers['anthropic-version'] = '2023-06-01'

    // 5. 添加 anthropic-beta（可配置）
    headers['anthropic-beta'] = options.betaHeader || DEFAULT_BETA_HEADER

    // 6. 覆盖 user-agent（如果账户配置了）
    if (account.userAgent) {
      headers['user-agent'] = account.userAgent
    }

    return headers
  }

  /**
   * 构建请求 URL
   * @param account - 账户
   * @param options - 转发选项
   * @returns 请求 URL
   */
  private buildRequestUrl(account: Account, options: RelayOptions): string {
    const baseUrl = account.apiUrl.replace(/\/$/, '') // 移除末尾斜杠

    if (options.customPath) {
      return `${baseUrl}${options.customPath}`
    }

    // 默认路径
    return `${baseUrl}/v1/messages`
  }

  /**
   * 应用模型映射
   * @param requestBody - 原始请求体
   * @param account - 账户
   * @returns 映射后的请求体
   */
  private applyModelMapping(requestBody: any, account: Account): any {
    if (!account.supportedModels || Object.keys(account.supportedModels).length === 0) {
      return requestBody
    }

    const requestedModel = requestBody.model
    const mappedModel = account.supportedModels[requestedModel]

    if (mappedModel && mappedModel !== requestedModel) {
      logger.debug({
        accountId: account.id,
        originalModel: requestedModel,
        mappedModel
      }, 'Applied model mapping')

      return {
        ...requestBody,
        model: mappedModel
      }
    }

    return requestBody
  }

  /**
   * 从响应中提取 Usage（非流式）
   * @param responseData - 响应数据
   * @param account - 账户
   * @returns Usage 对象或 null
   */
  private extractUsageFromResponse(responseData: any, account: Account): Usage | null {
    if (!responseData || !responseData.usage) {
      return null
    }

    const usage: Usage = {
      input_tokens: responseData.usage.input_tokens || 0,
      output_tokens: responseData.usage.output_tokens || 0,
      cache_creation_input_tokens: responseData.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: responseData.usage.cache_read_input_tokens || 0,
      model: responseData.model || 'unknown',
      accountId: account.id
    }

    // 提取详细缓存数据（如果有）
    if (responseData.usage.cache_creation) {
      usage.cache_creation = {
        ephemeral_5m_input_tokens:
          responseData.usage.cache_creation.ephemeral_5m_input_tokens || 0,
        ephemeral_1h_input_tokens: responseData.usage.cache_creation.ephemeral_1h_input_tokens || 0
      }
    }

    return usage
  }

  /**
   * 处理错误状态码，更新账户状态
   * @param account - 账户
   * @param response - 响应
   */
  private async handleErrorStatus(account: Account, response: AxiosResponse): Promise<void> {
    const status = response.status
    const accountPlatform = account.platform
    const accountId = account.id

    logger.warn({
      accountId,
      status,
      statusText: response.statusText
    }, 'Upstream returned error status')

    try {
      if (status === 401) {
        // 未授权
        await this.accountRepo.update(accountPlatform, accountId, {
          status: 'unauthorized',
          errorMessage: 'API key is invalid or expired'
        })
      } else if (status === 429) {
        // 限流
        await this.accountRepo.update(accountPlatform, accountId, {
          status: 'rate_limited',
          errorMessage: 'Rate limit exceeded'
        })
      } else if (status === 529) {
        // 过载
        await this.accountRepo.update(accountPlatform, accountId, {
          status: 'overloaded',
          errorMessage: 'Service is temporarily overloaded'
        })
      } else if (status >= 500) {
        // 服务器错误
        await this.accountRepo.update(accountPlatform, accountId, {
          status: 'temp_error',
          errorMessage: `Server error: ${status}`
        })
      }
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to update account status')
    }
  }
}
