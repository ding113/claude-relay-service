/**
 * Account Service Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'
import { AccountService } from '@/modules/account/service'
import type { AccountPlatform, CreateAccountOptions } from '@/shared/types'

describe('AccountService', () => {
  let redis: Redis
  let service: AccountService

  beforeEach(() => {
    redis = new RedisMock()
    service = new AccountService(redis)
  })

  afterEach(async () => {
    await redis.flushall()
    await redis.quit()
  })

  describe('createAccount', () => {
    it('should create Claude Console account with required fields', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key-123'
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.id).toBeDefined()
      expect(account.platform).toBe('claude-console')
      expect(account.apiUrl).toBe(options.apiUrl)
      expect(account.apiKey).toBe(options.apiKey)
      expect(account.isActive).toBe(true)
      expect(account.schedulable).toBe(true)
      expect(account.priority).toBe(50)
      expect(account.accountType).toBe('shared')
    })

    it('should create Codex account with default values', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://codex.anthropic.com/api',
        apiKey: 'codex-key-123'
      }

      const account = await service.createAccount('codex', options)

      expect(account.platform).toBe('codex')
      expect(account.priority).toBe(50)
      expect(account.schedulable).toBe(true)
      expect(account.accountType).toBe('shared')
      expect(account.dailyQuota).toBe(0)
      expect(account.dailyUsage).toBe(0)
    })

    it('should create account with custom name and description', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        name: 'Production Account',
        description: 'Main production API account'
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.name).toBe('Production Account')
      expect(account.description).toBe('Main production API account')
    })

    it('should create account with custom priority', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        priority: 10
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.priority).toBe(10)
    })

    it('should create inactive account when specified', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        isActive: false
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.isActive).toBe(false)
    })

    it('should create non-schedulable account when specified', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        schedulable: false
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.schedulable).toBe(false)
    })

    it('should create dedicated account when specified', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        accountType: 'dedicated'
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.accountType).toBe('dedicated')
    })

    it('should create account with model mapping (object format)', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        supportedModels: {
          'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
          'claude-3-opus': 'claude-3-opus-20240229'
        }
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.supportedModels).toEqual(options.supportedModels)
    })

    it('should create account with model mapping (array format)', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        supportedModels: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229']
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.supportedModels).toEqual({
        'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229': 'claude-3-opus-20240229'
      })
    })

    it('should create account with proxy configuration', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        proxy: {
          protocol: 'http',
          host: 'proxy.example.com',
          port: 8080
        }
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.proxy).toEqual(options.proxy)
    })

    it('should create account with proxy authentication', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        proxy: {
          protocol: 'http',
          host: 'proxy.example.com',
          port: 8080,
          auth: {
            username: 'proxyuser',
            password: 'proxypass'
          }
        }
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.proxy).toEqual(options.proxy)
    })

    it('should create account with daily quota', async () => {
      const options: CreateAccountOptions = {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        dailyQuota: 100.5
      }

      const account = await service.createAccount('claude-console', options)

      expect(account.dailyQuota).toBe(100.5)
      expect(account.dailyUsage).toBe(0)
    })

    it('should throw error if apiUrl is missing', async () => {
      const options: any = {
        apiKey: 'sk-ant-test-key'
      }

      await expect(service.createAccount('claude-console', options)).rejects.toThrow('apiUrl is required')
    })

    it('should throw error if apiKey is missing', async () => {
      const options: any = {
        apiUrl: 'https://api.anthropic.com/v1/messages'
      }

      await expect(service.createAccount('claude-console', options)).rejects.toThrow('apiKey is required')
    })
  })

  describe('getAccount', () => {
    it('should get existing account', async () => {
      const created = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key'
      })

      const account = await service.getAccount('claude-console', created.id)

      expect(account).not.toBeNull()
      expect(account!.id).toBe(created.id)
      expect(account!.apiUrl).toBe(created.apiUrl)
    })

    it('should return null for non-existent account', async () => {
      const account = await service.getAccount('claude-console', 'non-existent-id')

      expect(account).toBeNull()
    })
  })

  describe('listAccounts', () => {
    beforeEach(async () => {
      // 创建测试账户
      await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'key-1',
        name: 'Account 1',
        priority: 10,
        isActive: true,
        schedulable: true,
        accountType: 'shared'
      })

      await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'key-2',
        name: 'Account 2',
        priority: 50,
        isActive: false,
        schedulable: true,
        accountType: 'dedicated'
      })

      await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'key-3',
        name: 'Account 3',
        priority: 30,
        isActive: true,
        schedulable: false
      })

      await service.createAccount('codex', {
        apiUrl: 'https://codex.anthropic.com/api',
        apiKey: 'codex-key-1',
        priority: 20
      })
    })

    it('should list all Claude Console accounts', async () => {
      const accounts = await service.listAccounts('claude-console')

      expect(accounts).toHaveLength(3)
      expect(accounts.every((acc) => acc.platform === 'claude-console')).toBe(true)
    })

    it('should list all Codex accounts', async () => {
      const accounts = await service.listAccounts('codex')

      expect(accounts).toHaveLength(1)
      expect(accounts[0].platform).toBe('codex')
    })

    it('should sort accounts by priority ascending', async () => {
      const accounts = await service.listAccounts('claude-console')

      expect(accounts[0].priority).toBe(10)
      expect(accounts[1].priority).toBe(30)
      expect(accounts[2].priority).toBe(50)
    })

    it('should filter by isActive', async () => {
      const accounts = await service.listAccounts('claude-console', { isActive: true })

      expect(accounts).toHaveLength(2)
      expect(accounts.every((acc) => acc.isActive)).toBe(true)
    })

    it('should filter by schedulable', async () => {
      const accounts = await service.listAccounts('claude-console', { schedulable: true })

      expect(accounts).toHaveLength(2)
      expect(accounts.every((acc) => acc.schedulable)).toBe(true)
    })

    it('should filter by accountType', async () => {
      const accounts = await service.listAccounts('claude-console', { accountType: 'dedicated' })

      expect(accounts).toHaveLength(1)
      expect(accounts[0].accountType).toBe('dedicated')
    })

    it('should filter by multiple criteria', async () => {
      const accounts = await service.listAccounts('claude-console', {
        isActive: true,
        schedulable: true
      })

      expect(accounts).toHaveLength(1)
      expect(accounts[0].name).toBe('Account 1')
    })
  })

  describe('updateAccount', () => {
    let accountId: string

    beforeEach(async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        name: 'Test Account'
      })
      accountId = account.id
    })

    it('should update account name', async () => {
      const updated = await service.updateAccount('claude-console', accountId, {
        name: 'Updated Name'
      })

      expect(updated.name).toBe('Updated Name')
    })

    it('should update account description', async () => {
      const updated = await service.updateAccount('claude-console', accountId, {
        description: 'Updated description'
      })

      expect(updated.description).toBe('Updated description')
    })

    it('should update apiUrl', async () => {
      const updated = await service.updateAccount('claude-console', accountId, {
        apiUrl: 'https://new-api.example.com'
      })

      expect(updated.apiUrl).toBe('https://new-api.example.com')
    })

    it('should update priority', async () => {
      const updated = await service.updateAccount('claude-console', accountId, {
        priority: 100
      })

      expect(updated.priority).toBe(100)
    })

    it('should update schedulable status', async () => {
      const updated = await service.updateAccount('claude-console', accountId, {
        schedulable: false
      })

      expect(updated.schedulable).toBe(false)
    })

    it('should update isActive status', async () => {
      const updated = await service.updateAccount('claude-console', accountId, {
        isActive: false
      })

      expect(updated.isActive).toBe(false)
    })

    it('should update model mapping', async () => {
      const mapping = { 'claude-3-opus': 'claude-3-opus-20240229' }
      const updated = await service.updateAccount('claude-console', accountId, {
        supportedModels: mapping
      })

      expect(updated.supportedModels).toEqual(mapping)
    })

    it('should update proxy configuration', async () => {
      const proxy = {
        protocol: 'http' as const,
        host: 'proxy.example.com',
        port: 8080
      }
      const updated = await service.updateAccount('claude-console', accountId, {
        proxy
      })

      expect(updated.proxy).toEqual(proxy)
    })

    it('should update dailyQuota', async () => {
      const updated = await service.updateAccount('claude-console', accountId, {
        dailyQuota: 500
      })

      expect(updated.dailyQuota).toBe(500)
    })

    it('should throw error if account not found', async () => {
      await expect(
        service.updateAccount('claude-console', 'non-existent-id', {
          name: 'New Name'
        })
      ).rejects.toThrow('Account not found')
    })

    it('should update updatedAt timestamp', async () => {
      const before = new Date()
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await service.updateAccount('claude-console', accountId, {
        name: 'Updated'
      })

      const updatedAt = new Date(updated.updatedAt!)
      expect(updatedAt.getTime()).toBeGreaterThan(before.getTime())
    })
  })

  describe('deleteAccount', () => {
    it('should delete existing account', async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key'
      })

      await service.deleteAccount('claude-console', account.id)

      const deleted = await service.getAccount('claude-console', account.id)
      expect(deleted).toBeNull()
    })

    it('should throw error if account not found', async () => {
      await expect(service.deleteAccount('claude-console', 'non-existent-id')).rejects.toThrow(
        'Account not found'
      )
    })
  })

  describe('toggleSchedulable', () => {
    let accountId: string

    beforeEach(async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        schedulable: true
      })
      accountId = account.id
    })

    it('should toggle schedulable to false', async () => {
      const updated = await service.toggleSchedulable('claude-console', accountId, false)

      expect(updated.schedulable).toBe(false)
    })

    it('should toggle schedulable to true', async () => {
      await service.toggleSchedulable('claude-console', accountId, false)
      const updated = await service.toggleSchedulable('claude-console', accountId, true)

      expect(updated.schedulable).toBe(true)
    })
  })

  describe('updateAccountStatus', () => {
    let accountId: string

    beforeEach(async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key'
      })
      accountId = account.id
    })

    it('should update status to error with message', async () => {
      await service.updateAccountStatus('claude-console', accountId, 'error', 'API connection failed')

      const account = await service.getAccount('claude-console', accountId)
      expect(account!.status).toBe('error')
      expect(account!.errorMessage).toBe('API connection failed')
    })

    it('should update status to rate_limited', async () => {
      await service.updateAccountStatus('claude-console', accountId, 'rate_limited')

      const account = await service.getAccount('claude-console', accountId)
      expect(account!.status).toBe('rate_limited')
    })

    it('should clear error message when status is active', async () => {
      await service.updateAccountStatus('claude-console', accountId, 'error', 'Test error')
      await service.updateAccountStatus('claude-console', accountId, 'active')

      const account = await service.getAccount('claude-console', accountId)
      expect(account!.status).toBe('active')
      expect(account!.errorMessage).toBe('')
    })
  })

  describe('resetRateLimit', () => {
    let accountId: string

    beforeEach(async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        rateLimitDuration: 60
      })
      accountId = account.id

      // 模拟限流状态
      await service.updateAccount('claude-console', accountId, {
        rateLimitDuration: 60
      })
    })

    it('should reset rate limit fields', async () => {
      const updated = await service.resetRateLimit('claude-console', accountId)

      expect(updated.rateLimitedAt).toBeUndefined()
      expect(updated.rateLimitStatus).toBe('')
    })
  })

  describe('updateDailyUsage', () => {
    let accountId: string

    beforeEach(async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        dailyQuota: 100
      })
      accountId = account.id
    })

    it('should update daily usage', async () => {
      await service.updateDailyUsage('claude-console', accountId, 50.75)

      const account = await service.getAccount('claude-console', accountId)
      expect(account!.dailyUsage).toBe(50.75)
    })
  })

  describe('validateProxyConfig', () => {
    it('should validate valid http proxy', () => {
      const proxy = {
        protocol: 'http' as const,
        host: 'proxy.example.com',
        port: 8080
      }

      expect(service.validateProxyConfig(proxy)).toBe(true)
    })

    it('should validate valid socks5 proxy', () => {
      const proxy = {
        protocol: 'socks5' as const,
        host: '127.0.0.1',
        port: 1080
      }

      expect(service.validateProxyConfig(proxy)).toBe(true)
    })

    it('should reject invalid protocol', () => {
      const proxy: any = {
        protocol: 'ftp',
        host: 'proxy.example.com',
        port: 8080
      }

      expect(service.validateProxyConfig(proxy)).toBe(false)
    })

    it('should reject invalid port', () => {
      const proxy = {
        protocol: 'http' as const,
        host: 'proxy.example.com',
        port: 70000
      }

      expect(service.validateProxyConfig(proxy)).toBe(false)
    })

    it('should reject missing host', () => {
      const proxy: any = {
        protocol: 'http',
        port: 8080
      }

      expect(service.validateProxyConfig(proxy)).toBe(false)
    })
  })

  describe('checkAvailability', () => {
    it('should return available for active schedulable account', async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        isActive: true,
        schedulable: true
      })

      const result = service.checkAvailability(account)

      expect(result.available).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should return unavailable if not active', async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        isActive: false
      })

      const result = service.checkAvailability(account)

      expect(result.available).toBe(false)
      expect(result.reason).toBe('Account is not active')
    })

    it('should return unavailable if not schedulable', async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        schedulable: false
      })

      const result = service.checkAvailability(account)

      expect(result.available).toBe(false)
      expect(result.reason).toBe('Account is not schedulable')
    })

    it('should return unavailable if quota exceeded', async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        dailyQuota: 100
      })

      await service.updateDailyUsage('claude-console', account.id, 100)
      const updated = await service.getAccount('claude-console', account.id)

      const result = service.checkAvailability(updated!)

      expect(result.available).toBe(false)
      expect(result.reason).toBe('Daily quota exceeded')
    })

    it('should return unavailable if status is not active', async () => {
      const account = await service.createAccount('claude-console', {
        apiUrl: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key'
      })

      await service.updateAccountStatus('claude-console', account.id, 'error', 'Test error')
      const updated = await service.getAccount('claude-console', account.id)

      const result = service.checkAvailability(updated!)

      expect(result.available).toBe(false)
      expect(result.reason).toBe('Account status is error')
    })
  })
})
