/**
 * Admin Repository 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'
import { AdminRepository } from '@/core/redis/repositories/admin.repository'
import type { AdminCredentials } from '@/shared/types'

describe('AdminRepository', () => {
  let redis: Redis
  let repository: AdminRepository

  const testUsername = 'test-admin'
  const testPasswordHash = 'salt.hash'
  const testCredentials: AdminCredentials = {
    username: testUsername,
    passwordHash: testPasswordHash,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  beforeEach(() => {
    redis = new RedisMock()
    repository = new AdminRepository()
    // @ts-ignore - Replace redis client for testing
    repository['redis'] = redis
  })

  afterEach(async () => {
    await redis.flushall()
    await redis.quit()
  })

  describe('setCredentials', () => {
    it('should set admin credentials', async () => {
      await repository.setCredentials(testUsername, testPasswordHash)

      const saved = await redis.get('admin:credentials')
      expect(saved).toBeDefined()

      const parsed = JSON.parse(saved!)
      expect(parsed.username).toBe(testUsername)
      expect(parsed.passwordHash).toBe(testPasswordHash)
      expect(parsed.createdAt).toBeDefined()
      expect(parsed.updatedAt).toBeDefined()
    })

    it('should create credentials with timestamps', async () => {
      const beforeTime = Date.now()
      await repository.setCredentials(testUsername, testPasswordHash)
      const afterTime = Date.now()

      const credentials = await repository.getCredentials()
      expect(credentials).toBeDefined()
      expect(credentials!.createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(credentials!.createdAt).toBeLessThanOrEqual(afterTime)
      expect(credentials!.updatedAt).toBeGreaterThanOrEqual(beforeTime)
      expect(credentials!.updatedAt).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('getCredentials', () => {
    it('should get admin credentials', async () => {
      await redis.set('admin:credentials', JSON.stringify(testCredentials))

      const credentials = await repository.getCredentials()
      expect(credentials).toEqual(testCredentials)
    })

    it('should return null if credentials do not exist', async () => {
      const credentials = await repository.getCredentials()
      expect(credentials).toBeNull()
    })

    it('should handle corrupted data gracefully', async () => {
      await redis.set('admin:credentials', 'invalid-json')

      await expect(repository.getCredentials()).rejects.toThrow()
    })
  })

  describe('updateCredentials', () => {
    beforeEach(async () => {
      await repository.setCredentials(testUsername, testPasswordHash)
    })

    it('should update admin credentials', async () => {
      const newPasswordHash = 'new-salt.new-hash'
      const newUsername = 'new-admin'

      await repository.updateCredentials(newUsername, newPasswordHash)

      const credentials = await repository.getCredentials()
      expect(credentials).toBeDefined()
      expect(credentials!.username).toBe(newUsername)
      expect(credentials!.passwordHash).toBe(newPasswordHash)
    })

    it('should update timestamp when updating credentials', async () => {
      const oldCredentials = await repository.getCredentials()
      expect(oldCredentials).toBeDefined()

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10))

      await repository.updateCredentials(testUsername, 'new-hash')

      const newCredentials = await repository.getCredentials()
      expect(newCredentials).toBeDefined()
      expect(newCredentials!.updatedAt).toBeGreaterThan(oldCredentials!.updatedAt)
      expect(newCredentials!.createdAt).toBe(oldCredentials!.createdAt)
    })

    it('should throw error if credentials do not exist', async () => {
      await repository.delete()

      await expect(repository.updateCredentials('user', 'hash')).rejects.toThrow(
        'Admin credentials not found'
      )
    })
  })

  describe('exists', () => {
    it('should return true if credentials exist', async () => {
      await repository.setCredentials(testUsername, testPasswordHash)

      const exists = await repository.exists()
      expect(exists).toBe(true)
    })

    it('should return false if credentials do not exist', async () => {
      const exists = await repository.exists()
      expect(exists).toBe(false)
    })
  })

  describe('delete', () => {
    it('should delete admin credentials', async () => {
      await repository.setCredentials(testUsername, testPasswordHash)

      const existsBefore = await repository.exists()
      expect(existsBefore).toBe(true)

      await repository.delete()

      const existsAfter = await repository.exists()
      expect(existsAfter).toBe(false)
    })

    it('should not throw error if credentials do not exist', async () => {
      await expect(repository.delete()).resolves.not.toThrow()
    })
  })

  describe('Integration', () => {
    it('should handle full lifecycle', async () => {
      // Create
      await repository.setCredentials(testUsername, testPasswordHash)
      let credentials = await repository.getCredentials()
      expect(credentials).toBeDefined()
      expect(credentials!.username).toBe(testUsername)

      // Update
      await repository.updateCredentials('new-admin', 'new-hash')
      credentials = await repository.getCredentials()
      expect(credentials!.username).toBe('new-admin')

      // Delete
      await repository.delete()
      credentials = await repository.getCredentials()
      expect(credentials).toBeNull()
    })
  })
})
