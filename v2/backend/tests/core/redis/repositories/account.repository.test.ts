/**
 * Account Repository 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'
import { AccountRepository } from '@core/redis/repositories/account.repository'
import type { AccountData, AccountPlatform } from '@shared/types'
import { decryptSensitiveData } from '@core/redis/utils/encryption'

describe('AccountRepository', () => {
  let redis: Redis
  let repository: AccountRepository

  // 测试用的账户数据
  const testAccountId = 'test-account-123'
  const testAccountData: AccountData = {
    id: testAccountId,
    platform: 'claude-console',
    name: 'Test Console Account',
    description: 'Test description',
    apiUrl: 'https://api.example.com',
    apiKey: 'test-api-key-secret',
    userAgent: 'claude-cli/1.0.69',
    supportedModels: '{}',
    priority: '50',
    schedulable: 'true',
    isActive: 'true',
    status: 'active',
    errorMessage: '',
    rateLimitDuration: '60',
    rateLimitedAt: '',
    rateLimitStatus: '',
    rateLimitAutoStopped: '',
    dailyQuota: '100',
    dailyUsage: '0',
    lastResetDate: '2025-10-04',
    quotaResetTime: '00:00',
    quotaStoppedAt: '',
    quotaAutoStopped: '',
    unauthorizedAt: '',
    unauthorizedCount: '0',
    overloadedAt: '',
    overloadStatus: '',
    blockedAt: '',
    accountType: 'shared',
    proxy: '',
    createdAt: new Date().toISOString(),
    lastUsedAt: ''
  }

  beforeEach(() => {
    redis = new RedisMock()
    repository = new AccountRepository(redis)
  })

  afterEach(async () => {
    await redis.flushall()
    await redis.quit()
  })

  describe('save - Claude Console', () => {
    it('should save account data with encrypted API key', async () => {
      await repository.save(testAccountId, testAccountData)

      const saved = await redis.hgetall(`claude_console_account:${testAccountId}`)
      expect(saved.name).toBe('Test Console Account')
      expect(saved.apiKey).not.toBe('test-api-key-secret') // Should be encrypted
      expect(saved.apiKey).toContain(':') // Encrypted format
    })

    it('should decrypt API key when retrieved', async () => {
      await repository.save(testAccountId, testAccountData)

      const saved = await redis.hgetall(`claude_console_account:${testAccountId}`)
      const decrypted = decryptSensitiveData(saved.apiKey)
      expect(decrypted).toBe('test-api-key-secret')
    })

    it('should add shared account to shared set', async () => {
      await repository.save(testAccountId, testAccountData)

      const sharedIds = await redis.smembers('shared_claude_console_accounts')
      expect(sharedIds).toContain(testAccountId)
    })

    it('should not add dedicated account to shared set', async () => {
      const dedicatedAccount = { ...testAccountData, accountType: 'dedicated' }
      await repository.save(testAccountId, dedicatedAccount)

      const sharedIds = await redis.smembers('shared_claude_console_accounts')
      expect(sharedIds).not.toContain(testAccountId)
    })
  })

  describe('save - Codex', () => {
    const codexAccount: AccountData = {
      ...testAccountData,
      platform: 'codex'
    }

    it('should save codex account to correct key', async () => {
      await repository.save(testAccountId, codexAccount)

      const saved = await redis.hgetall(`codex_account:${testAccountId}`)
      expect(saved.name).toBe('Test Console Account')
    })

    it('should add shared codex account to shared set', async () => {
      await repository.save(testAccountId, codexAccount)

      const sharedIds = await redis.smembers('shared_codex_accounts')
      expect(sharedIds).toContain(testAccountId)
    })
  })

  describe('findById', () => {
    beforeEach(async () => {
      await repository.save(testAccountId, testAccountData)
    })

    it('should find account by ID with decrypted API key', async () => {
      const found = await repository.findById('claude-console', testAccountId)

      expect(found).not.toBeNull()
      expect(found?.name).toBe('Test Console Account')
      expect(found?.apiKey).toBe('test-api-key-secret') // Should be decrypted
    })

    it('should return null when account does not exist', async () => {
      const found = await repository.findById('claude-console', 'non-existent')
      expect(found).toBeNull()
    })

    it('should find codex account', async () => {
      const codexAccount = { ...testAccountData, platform: 'codex' as AccountPlatform }
      await repository.save('codex-123', codexAccount)

      const found = await repository.findById('codex', 'codex-123')
      expect(found).not.toBeNull()
      expect(found?.platform).toBe('codex')
    })
  })

  describe('findAll', () => {
    it('should return all claude console accounts', async () => {
      const account1 = { ...testAccountData, id: 'acc1', name: 'Account 1' }
      const account2 = { ...testAccountData, id: 'acc2', name: 'Account 2' }

      await repository.save('acc1', account1)
      await repository.save('acc2', account2)

      const all = await repository.findAll('claude-console')

      expect(all).toHaveLength(2)
      const names = all.map((a) => a.name)
      expect(names).toContain('Account 1')
      expect(names).toContain('Account 2')
    })

    it('should decrypt all API keys', async () => {
      await repository.save('acc1', testAccountData)

      const all = await repository.findAll('claude-console')

      expect(all[0].apiKey).toBe('test-api-key-secret')
    })

    it('should return empty array when no accounts exist', async () => {
      const all = await repository.findAll('claude-console')
      expect(all).toEqual([])
    })

    it('should not mix platforms', async () => {
      // Clear any existing data first
      await redis.flushall()

      await repository.save('claude1', { ...testAccountData, id: 'claude1' })
      await repository.save('codex1', { ...testAccountData, id: 'codex1', platform: 'codex' })

      const claudeAccounts = await repository.findAll('claude-console')
      const codexAccounts = await repository.findAll('codex')

      expect(claudeAccounts).toHaveLength(1)
      expect(codexAccounts).toHaveLength(1)
      expect(claudeAccounts[0].id).toBe('claude1')
      expect(codexAccounts[0].id).toBe('codex1')
    })
  })

  describe('delete', () => {
    beforeEach(async () => {
      await repository.save(testAccountId, testAccountData)
    })

    it('should delete account', async () => {
      await repository.delete('claude-console', testAccountId)

      const exists = await redis.exists(`claude_console_account:${testAccountId}`)
      expect(exists).toBe(0)
    })

    it('should remove from shared set when deleting shared account', async () => {
      await repository.delete('claude-console', testAccountId)

      const sharedIds = await redis.smembers('shared_claude_console_accounts')
      expect(sharedIds).not.toContain(testAccountId)
    })

    it('should not throw when deleting non-existent account', async () => {
      await expect(repository.delete('claude-console', 'non-existent')).resolves.toBeUndefined()
    })
  })

  describe('update', () => {
    beforeEach(async () => {
      await repository.save(testAccountId, testAccountData)
    })

    it('should update account fields', async () => {
      await repository.update('claude-console', testAccountId, {
        isActive: 'false',
        status: 'error',
        errorMessage: 'Test error'
      })

      const updated = await repository.findById('claude-console', testAccountId)
      expect(updated?.isActive).toBe('false')
      expect(updated?.status).toBe('error')
      expect(updated?.errorMessage).toBe('Test error')
    })

    it('should preserve other fields when updating', async () => {
      await repository.update('claude-console', testAccountId, { isActive: 'false' })

      const updated = await repository.findById('claude-console', testAccountId)
      expect(updated?.name).toBe('Test Console Account')
      expect(updated?.apiKey).toBe('test-api-key-secret')
    })

    it('should encrypt API key when updating', async () => {
      await repository.update('claude-console', testAccountId, {
        apiKey: 'new-secret-key'
      })

      const rawData = await redis.hgetall(`claude_console_account:${testAccountId}`)
      expect(rawData.apiKey).not.toBe('new-secret-key')
      expect(rawData.apiKey).toContain(':')

      const updated = await repository.findById('claude-console', testAccountId)
      expect(updated?.apiKey).toBe('new-secret-key')
    })

    it('should update shared set when changing accountType', async () => {
      // Change from shared to dedicated
      await repository.update('claude-console', testAccountId, {
        accountType: 'dedicated'
      })

      let sharedIds = await redis.smembers('shared_claude_console_accounts')
      expect(sharedIds).not.toContain(testAccountId)

      // Change back to shared
      await repository.update('claude-console', testAccountId, {
        accountType: 'shared'
      })

      sharedIds = await redis.smembers('shared_claude_console_accounts')
      expect(sharedIds).toContain(testAccountId)
    })
  })

  describe('exists', () => {
    it('should return true when account exists', async () => {
      await repository.save(testAccountId, testAccountData)

      const exists = await repository.exists('claude-console', testAccountId)
      expect(exists).toBe(true)
    })

    it('should return false when account does not exist', async () => {
      const exists = await repository.exists('claude-console', 'non-existent')
      expect(exists).toBe(false)
    })
  })

  describe('getSharedAccountIds', () => {
    it('should return shared account IDs', async () => {
      const shared1 = { ...testAccountData, id: 'shared1', accountType: 'shared' }
      const shared2 = { ...testAccountData, id: 'shared2', accountType: 'shared' }
      const dedicated = { ...testAccountData, id: 'dedicated1', accountType: 'dedicated' }

      await repository.save('shared1', shared1)
      await repository.save('shared2', shared2)
      await repository.save('dedicated1', dedicated)

      const sharedIds = await repository.getSharedAccountIds('claude-console')

      expect(sharedIds).toHaveLength(2)
      expect(sharedIds).toContain('shared1')
      expect(sharedIds).toContain('shared2')
      expect(sharedIds).not.toContain('dedicated1')
    })

    it('should return empty array when no shared accounts', async () => {
      const sharedIds = await repository.getSharedAccountIds('claude-console')
      expect(sharedIds).toEqual([])
    })
  })

  describe('findByIds', () => {
    beforeEach(async () => {
      await repository.save('acc1', { ...testAccountData, id: 'acc1', name: 'Account 1' })
      await repository.save('acc2', { ...testAccountData, id: 'acc2', name: 'Account 2' })
      await repository.save('acc3', { ...testAccountData, id: 'acc3', name: 'Account 3' })
    })

    it('should return accounts in the same order as input', async () => {
      const results = await repository.findByIds('claude-console', ['acc2', 'acc1', 'acc3'])

      expect(results).toHaveLength(3)
      expect(results[0]?.name).toBe('Account 2')
      expect(results[1]?.name).toBe('Account 1')
      expect(results[2]?.name).toBe('Account 3')
    })

    it('should return null for non-existent accounts', async () => {
      const results = await repository.findByIds('claude-console', ['acc1', 'non-existent', 'acc2'])

      expect(results).toHaveLength(3)
      expect(results[0]?.name).toBe('Account 1')
      expect(results[1]).toBeNull()
      expect(results[2]?.name).toBe('Account 2')
    })

    it('should decrypt all API keys', async () => {
      const results = await repository.findByIds('claude-console', ['acc1', 'acc2'])

      expect(results[0]?.apiKey).toBe('test-api-key-secret')
      expect(results[1]?.apiKey).toBe('test-api-key-secret')
    })

    it('should return empty array for empty input', async () => {
      const results = await repository.findByIds('claude-console', [])
      expect(results).toEqual([])
    })

    it('should handle duplicates in input', async () => {
      const results = await repository.findByIds('claude-console', ['acc1', 'acc1'])

      expect(results).toHaveLength(2)
      expect(results[0]?.name).toBe('Account 1')
      expect(results[1]?.name).toBe('Account 1')
    })
  })

  describe('Platform-specific behavior', () => {
    it('should handle different platforms independently', async () => {
      const claudeAccount = { ...testAccountData, platform: 'claude-console' as AccountPlatform }
      const codexAccount = { ...testAccountData, platform: 'codex' as AccountPlatform }

      await repository.save('acc1', claudeAccount)
      await repository.save('acc1', codexAccount) // Same ID, different platform

      const claude = await repository.findById('claude-console', 'acc1')
      const codex = await repository.findById('codex', 'acc1')

      expect(claude).not.toBeNull()
      expect(codex).not.toBeNull()
      expect(claude?.platform).toBe('claude-console')
      expect(codex?.platform).toBe('codex')
    })
  })
})
