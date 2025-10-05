/**
 * API Key Service Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'
import { ApiKeyService } from '@/modules/apikey/service'

describe('ApiKeyService', () => {
  let redis: Redis
  let service: ApiKeyService

  beforeEach(() => {
    redis = new RedisMock()
    // Inject mock Redis into service
    service = new ApiKeyService(redis)
  })

  afterEach(async () => {
    await redis.flushall()
    await redis.quit()
  })

  describe('createApiKey', () => {
    it('should create a new API Key with default options', async () => {
      const result = await service.createApiKey()

      expect(result.key).toBeDefined()
      expect(result.rawKey).toBeDefined()
      expect(result.rawKey).toMatch(/^cr_[a-f0-9]{32}$/)
      expect(result.key.id).toBeDefined()
      expect(result.key.name).toBeDefined()
      expect(result.key.isActive).toBe(true)
      expect(result.key.isDeleted).toBe(false)
    })

    it('should create API Key with custom name', async () => {
      const result = await service.createApiKey({
        name: 'Test API Key'
      })

      expect(result.key.name).toBe('Test API Key')
    })

    it('should create API Key with custom description', async () => {
      const result = await service.createApiKey({
        description: 'This is a test API key'
      })

      expect(result.key.description).toBe('This is a test API key')
    })

    it('should create inactive API Key when specified', async () => {
      const result = await service.createApiKey({
        isActive: false
      })

      expect(result.key.isActive).toBe(false)
    })

    it('should create API Key with permissions', async () => {
      const result = await service.createApiKey({
        permissions: 'claude'
      })

      expect(result.key.permissions).toBe('claude')
    })

    it('should create API Key with rate limits', async () => {
      const result = await service.createApiKey({
        concurrencyLimit: 5,
        rateLimitWindow: 60,
        rateLimitRequests: 100
      })

      expect(result.key.concurrencyLimit).toBe(5)
      expect(result.key.rateLimitWindow).toBe(60)
      expect(result.key.rateLimitRequests).toBe(100)
    })

    it('should create API Key with cost limits', async () => {
      const result = await service.createApiKey({
        dailyCostLimit: 10.5,
        totalCostLimit: 100.0
      })

      expect(result.key.dailyCostLimit).toBe(10.5)
      expect(result.key.totalCostLimit).toBe(100.0)
    })

    it('should create API Key with tags', async () => {
      const result = await service.createApiKey({
        tags: ['production', 'high-priority']
      })

      expect(result.key.tags).toEqual(['production', 'high-priority'])
    })

    it('should create API Key with model restrictions', async () => {
      const result = await service.createApiKey({
        enableModelRestriction: true,
        restrictedModels: ['claude-3-opus', 'claude-3-sonnet']
      })

      expect(result.key.enableModelRestriction).toBe(true)
      expect(result.key.restrictedModels).toEqual(['claude-3-opus', 'claude-3-sonnet'])
    })
  })

  describe('getApiKey', () => {
    it('should get existing API Key', async () => {
      const created = await service.createApiKey({ name: 'Test Key' })
      const fetched = await service.getApiKey(created.key.id)

      expect(fetched).toBeDefined()
      expect(fetched!.id).toBe(created.key.id)
      expect(fetched!.name).toBe('Test Key')
    })

    it('should return null for non-existent API Key', async () => {
      const fetched = await service.getApiKey('non-existent-id')

      expect(fetched).toBeNull()
    })
  })

  describe('listApiKeys', () => {
    it('should list all API Keys', async () => {
      await service.createApiKey({ name: 'Key 1' })
      await service.createApiKey({ name: 'Key 2' })
      await service.createApiKey({ name: 'Key 3' })

      const keys = await service.listApiKeys()

      expect(keys).toHaveLength(3)
    })

    it('should exclude deleted keys by default', async () => {
      const created1 = await service.createApiKey({ name: 'Key 1' })
      await service.createApiKey({ name: 'Key 2' })

      await service.deleteApiKey(created1.key.id)

      const keys = await service.listApiKeys()

      expect(keys).toHaveLength(1)
      expect(keys[0].name).toBe('Key 2')
    })

    it('should include deleted keys when requested', async () => {
      const created1 = await service.createApiKey({ name: 'Key 1' })
      await service.createApiKey({ name: 'Key 2' })

      await service.deleteApiKey(created1.key.id)

      const keys = await service.listApiKeys({ includeDeleted: true })

      expect(keys).toHaveLength(2)
    })

    it('should filter by active status', async () => {
      await service.createApiKey({ name: 'Active Key', isActive: true })
      await service.createApiKey({ name: 'Inactive Key', isActive: false })

      const activeKeys = await service.listApiKeys({ isActive: true })
      const inactiveKeys = await service.listApiKeys({ isActive: false })

      expect(activeKeys).toHaveLength(1)
      expect(activeKeys[0].name).toBe('Active Key')
      expect(inactiveKeys).toHaveLength(1)
      expect(inactiveKeys[0].name).toBe('Inactive Key')
    })

    it('should filter by permissions', async () => {
      await service.createApiKey({ name: 'Claude Key', permissions: 'claude' })
      await service.createApiKey({ name: 'Codex Key', permissions: 'codex' })
      await service.createApiKey({ name: 'All Key', permissions: 'all' })

      const claudeKeys = await service.listApiKeys({ permissions: 'claude' })
      const codexKeys = await service.listApiKeys({ permissions: 'codex' })

      expect(claudeKeys).toHaveLength(1)
      expect(claudeKeys[0].name).toBe('Claude Key')
      expect(codexKeys).toHaveLength(1)
      expect(codexKeys[0].name).toBe('Codex Key')
    })

    it('should sort by creation date (newest first)', async () => {
      await service.createApiKey({ name: 'Key 1' })
      await new Promise((resolve) => setTimeout(resolve, 10))
      await service.createApiKey({ name: 'Key 2' })
      await new Promise((resolve) => setTimeout(resolve, 10))
      await service.createApiKey({ name: 'Key 3' })

      const keys = await service.listApiKeys()

      expect(keys[0].name).toBe('Key 3')
      expect(keys[1].name).toBe('Key 2')
      expect(keys[2].name).toBe('Key 1')
    })
  })

  describe('updateApiKey', () => {
    it('should update API Key name', async () => {
      const created = await service.createApiKey({ name: 'Old Name' })
      const updated = await service.updateApiKey(created.key.id, { name: 'New Name' })

      expect(updated.name).toBe('New Name')
    })

    it('should update API Key description', async () => {
      const created = await service.createApiKey()
      const updated = await service.updateApiKey(created.key.id, {
        description: 'Updated description'
      })

      expect(updated.description).toBe('Updated description')
    })

    it('should update API Key active status', async () => {
      const created = await service.createApiKey({ isActive: true })
      const updated = await service.updateApiKey(created.key.id, { isActive: false })

      expect(updated.isActive).toBe(false)
    })

    it('should update API Key permissions', async () => {
      const created = await service.createApiKey({ permissions: 'all' })
      const updated = await service.updateApiKey(created.key.id, { permissions: 'claude' })

      expect(updated.permissions).toBe('claude')
    })

    it('should update API Key rate limits', async () => {
      const created = await service.createApiKey()
      const updated = await service.updateApiKey(created.key.id, {
        concurrencyLimit: 10,
        rateLimitWindow: 120
      })

      expect(updated.concurrencyLimit).toBe(10)
      expect(updated.rateLimitWindow).toBe(120)
    })

    it('should update API Key tags', async () => {
      const created = await service.createApiKey({ tags: ['old-tag'] })
      const updated = await service.updateApiKey(created.key.id, {
        tags: ['new-tag-1', 'new-tag-2']
      })

      expect(updated.tags).toEqual(['new-tag-1', 'new-tag-2'])
    })

    it('should throw error for non-existent API Key', async () => {
      await expect(
        service.updateApiKey('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow('API Key not found')
    })

    it('should throw error when updating deleted API Key', async () => {
      const created = await service.createApiKey()
      await service.deleteApiKey(created.key.id)

      await expect(
        service.updateApiKey(created.key.id, { name: 'New Name' })
      ).rejects.toThrow('Cannot update deleted API Key')
    })

    it('should set updatedAt timestamp', async () => {
      const created = await service.createApiKey()
      await new Promise((resolve) => setTimeout(resolve, 10))
      const updated = await service.updateApiKey(created.key.id, { name: 'Updated' })

      expect(updated.updatedAt).toBeDefined()
      expect(new Date(updated.updatedAt!).getTime()).toBeGreaterThan(
        new Date(created.key.createdAt).getTime()
      )
    })
  })

  describe('deleteApiKey', () => {
    it('should soft delete API Key', async () => {
      const created = await service.createApiKey()
      await service.deleteApiKey(created.key.id)

      const deleted = await service.getApiKey(created.key.id)

      expect(deleted).toBeDefined()
      expect(deleted!.isDeleted).toBe(true)
      expect(deleted!.isActive).toBe(false)
      expect(deleted!.deletedAt).toBeDefined()
      expect(deleted!.deletedBy).toBe('admin')
    })

    it('should use custom deletedBy', async () => {
      const created = await service.createApiKey()
      await service.deleteApiKey(created.key.id, 'user123')

      const deleted = await service.getApiKey(created.key.id)

      expect(deleted!.deletedBy).toBe('user123')
    })

    it('should throw error for non-existent API Key', async () => {
      await expect(service.deleteApiKey('non-existent-id')).rejects.toThrow('API Key not found')
    })

    it('should throw error when deleting already deleted API Key', async () => {
      const created = await service.createApiKey()
      await service.deleteApiKey(created.key.id)

      await expect(service.deleteApiKey(created.key.id)).rejects.toThrow('API Key already deleted')
    })
  })

  describe('restoreApiKey', () => {
    it('should restore deleted API Key', async () => {
      const created = await service.createApiKey()
      await service.deleteApiKey(created.key.id)
      const restored = await service.restoreApiKey(created.key.id)

      expect(restored.isDeleted).toBe(false)
      expect(restored.restoredAt).toBeDefined()
      expect(restored.restoredBy).toBe('admin')
      expect(restored.deletedAt).toBeUndefined()
      expect(restored.deletedBy).toBeUndefined()
    })

    it('should use custom restoredBy', async () => {
      const created = await service.createApiKey()
      await service.deleteApiKey(created.key.id)
      const restored = await service.restoreApiKey(created.key.id, 'user123')

      expect(restored.restoredBy).toBe('user123')
    })

    it('should throw error for non-existent API Key', async () => {
      await expect(service.restoreApiKey('non-existent-id')).rejects.toThrow('API Key not found')
    })

    it('should throw error when restoring non-deleted API Key', async () => {
      const created = await service.createApiKey()

      await expect(service.restoreApiKey(created.key.id)).rejects.toThrow('API Key is not deleted')
    })
  })

  describe('Integration', () => {
    it('should handle full CRUD lifecycle', async () => {
      // Create
      const created = await service.createApiKey({
        name: 'Lifecycle Test',
        description: 'Testing full lifecycle'
      })

      expect(created.key.name).toBe('Lifecycle Test')
      expect(created.rawKey).toMatch(/^cr_[a-f0-9]{32}$/)

      // Read
      const fetched = await service.getApiKey(created.key.id)
      expect(fetched).toBeDefined()
      expect(fetched!.name).toBe('Lifecycle Test')

      // Update
      const updated = await service.updateApiKey(created.key.id, {
        name: 'Updated Name',
        description: 'Updated description'
      })
      expect(updated.name).toBe('Updated Name')

      // Delete
      await service.deleteApiKey(created.key.id, 'test-admin')
      const deleted = await service.getApiKey(created.key.id)
      expect(deleted!.isDeleted).toBe(true)

      // Restore
      const restored = await service.restoreApiKey(created.key.id, 'test-admin')
      expect(restored.isDeleted).toBe(false)
      expect(restored.name).toBe('Updated Name')
    })

    it('should handle multiple API Keys', async () => {
      const keys = await Promise.all([
        service.createApiKey({ name: 'Key 1', permissions: 'claude' }),
        service.createApiKey({ name: 'Key 2', permissions: 'codex' }),
        service.createApiKey({ name: 'Key 3', permissions: 'all', isActive: false })
      ])

      expect(keys).toHaveLength(3)

      const allKeys = await service.listApiKeys()
      expect(allKeys).toHaveLength(3)

      const activeKeys = await service.listApiKeys({ isActive: true })
      expect(activeKeys).toHaveLength(2)

      const claudeKeys = await service.listApiKeys({ permissions: 'claude' })
      expect(claudeKeys).toHaveLength(1)
      expect(claudeKeys[0].name).toBe('Key 1')
    })
  })
})
