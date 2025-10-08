/**
 * Proxy Agent Service
 * 代理 Agent 创建服务
 * 对应 v1 的 proxyHelper
 */

import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import type { Agent } from 'http'
import logger from '@/core/logger'
import { config } from '@/core/config'
import type { ProxyConfig } from '@/shared/types/account'

interface ProxyOptions {
  useIPv4?: boolean | number | string // true=IPv4, false=IPv6, null=auto
}

export class ProxyAgentService {
  /**
   * 创建代理 Agent
   * @param proxyConfig - 代理配置对象或 JSON 字符串
   * @param options - 额外选项
   * @returns 代理 Agent 实例或 null
   */
  createProxyAgent(proxyConfig: ProxyConfig | string | null, options: ProxyOptions = {}): Agent | null {
    if (!proxyConfig) {
      return null
    }

    try {
      // 解析代理配置
      const proxy = typeof proxyConfig === 'string' ? JSON.parse(proxyConfig) : proxyConfig

      // 验证必要字段
      if (!proxy.protocol || !proxy.host || !proxy.port) {
        logger.warn('Invalid proxy configuration: missing required fields (protocol, host, port)')
        return null
      }

      // 根据代理类型创建 Agent
      if (proxy.protocol === 'socks5') {
        return this.createSocksAgent(proxy, options)
      } else if (proxy.protocol === 'http' || proxy.protocol === 'https') {
        return this.createHttpAgent(proxy, options)
      } else {
        logger.warn({ protocol: proxy.protocol }, 'Unsupported proxy type')
        return null
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to create proxy agent')
      return null
    }
  }

  /**
   * 创建 SOCKS5 代理 Agent
   * @param proxy - 代理配置
   * @param options - 选项
   * @returns SocksProxyAgent
   */
  private createSocksAgent(proxy: ProxyConfig, options: ProxyOptions = {}): SocksProxyAgent {
    // 构建认证信息
    const auth = proxy.auth?.username && proxy.auth?.password
      ? `${proxy.auth.username}:${proxy.auth.password}@`
      : ''

    const socksUrl = `socks5h://${auth}${proxy.host}:${proxy.port}`

    // 设置 IP 协议族（如果指定）
    const socksOptions: any = {}
    const useIPv4 = this.getIPFamilyPreference(options.useIPv4)

    if (useIPv4 !== null) {
      socksOptions.family = useIPv4 ? 4 : 6
    }

    logger.debug({ url: socksUrl, family: socksOptions.family }, 'Creating SOCKS5 proxy agent')

    return new SocksProxyAgent(socksUrl, socksOptions)
  }

  /**
   * 创建 HTTP/HTTPS 代理 Agent
   * @param proxy - 代理配置
   * @param options - 选项
   * @returns HttpsProxyAgent
   */
  private createHttpAgent(proxy: ProxyConfig, options: ProxyOptions = {}): HttpsProxyAgent<string> {
    // 构建认证信息
    const auth = proxy.auth?.username && proxy.auth?.password
      ? `${proxy.auth.username}:${proxy.auth.password}@`
      : ''

    const proxyUrl = `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`

    // HttpsProxyAgent 支持 family 参数（通过底层的 agent-base）
    const httpOptions: any = {}
    const useIPv4 = this.getIPFamilyPreference(options.useIPv4)

    if (useIPv4 !== null) {
      httpOptions.family = useIPv4 ? 4 : 6
    }

    logger.debug({ url: proxyUrl, family: httpOptions.family }, 'Creating HTTP/HTTPS proxy agent')

    return new HttpsProxyAgent(proxyUrl, httpOptions)
  }

  /**
   * 获取 IP 协议族偏好设置
   * @param preference - 用户偏好设置
   * @returns true=IPv4, false=IPv6, null=auto
   */
  private getIPFamilyPreference(preference?: boolean | number | string): boolean | null {
    // 如果没有指定偏好，使用配置文件或默认值
    if (preference === undefined) {
      // 从配置文件读取默认设置，默认使用 IPv4
      const defaultUseIPv4 = config.PROXY_USE_IPV4
      if (defaultUseIPv4 !== undefined) {
        return defaultUseIPv4
      }
      // 默认值：IPv4（兼容性更好）
      return true
    }

    // 处理各种输入格式
    if (typeof preference === 'boolean') {
      return preference
    }

    if (typeof preference === 'number') {
      return preference === 4 ? true : preference === 6 ? false : null
    }

    if (typeof preference === 'string') {
      const lower = preference.toLowerCase()
      if (lower === 'ipv4' || lower === '4') {
        return true
      }
      if (lower === 'ipv6' || lower === '6') {
        return false
      }
      if (lower === 'auto' || lower === 'null') {
        return null
      }
    }

    return null
  }
}
