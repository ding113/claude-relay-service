/**
 * API Key Routes Integration Tests
 * Tests HTTP layer endpoints for API Key management
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'

// Initialize mock Redis before mocking
const mockRedis = new RedisMock()

vi.mock('@/core/redis/client', () => ({
  redisClient: {
    connect: vi.fn().mockResolvedValue(mockRedis),
    getClient: vi.fn().mockReturnValue(mockRedis),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(true)
  },
  default: {
    connect: vi.fn().mockResolvedValue(mockRedis),
    getClient: vi.fn().mockReturnValue(mockRedis),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(true)
  }
}))

import { buildApp, generateTestToken } from '@tests/helpers/app'

describe('API Key Routes', () => {
  let app: FastifyInstance
  let token: string
  let createdKeyId: string

  beforeEach(async () => {
    await mockRedis.flushall()
    app = await buildApp()
    token = generateTestToken(app, { username: 'test-admin', role: 'admin' })
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/v2/keys', () => {
    it('should create API Key with minimal config', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Test Key'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('key')
      expect(body).toHaveProperty('rawKey')
      expect(body.rawKey).toMatch(/^cr_[a-f0-9]{32}$/)
      expect(body.key.name).toBe('Test Key')

      createdKeyId = body.key.id
    })

    it('should create API Key with full configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Full Config Key',
          description: 'Test key with all options',
          permissions: 'claude',
          concurrencyLimit: 5,
          dailyCostLimit: 10.5,
          enableModelRestriction: true,
          restrictedModels: ['claude-3-opus', 'claude-3-sonnet'],
          tags: ['production', 'high-priority']
        }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.key.name).toBe('Full Config Key')
      expect(body.key.permissions).toBe('claude')
      expect(body.key.concurrencyLimit).toBe(5)
      expect(body.key.dailyCostLimit).toBe(10.5)
      expect(body.key.enableModelRestriction).toBe(true)
      expect(body.key.restrictedModels).toEqual(['claude-3-opus', 'claude-3-sonnet'])
      expect(body.key.tags).toEqual(['production', 'high-priority'])
    })

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        payload: { name: 'Test Key' }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should fail with invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: 'Bearer invalid-token' },
        payload: { name: 'Test Key' }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/v2/keys', () => {
    beforeEach(async () => {
      // Create test keys
      await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Active Key', isActive: true, permissions: 'claude' }
      })

      await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Inactive Key', isActive: false, permissions: 'codex' }
      })
    })

    it('should list all API Keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('keys')
      expect(body).toHaveProperty('total')
      expect(Array.isArray(body.keys)).toBe(true)
      expect(body.total).toBeGreaterThanOrEqual(2)
    })

    it('should filter by isActive=true', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/keys?isActive=true',
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.keys.every((k: any) => k.isActive === true)).toBe(true)
    })

    it('should filter by isActive=false', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/keys?isActive=false',
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.keys.every((k: any) => k.isActive === false)).toBe(true)
    })

    it('should filter by permissions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/keys?permissions=claude',
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.keys.every((k: any) => k.permissions === 'claude')).toBe(true)
    })

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/keys'
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/v2/keys/:id', () => {
    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Get Test Key' }
      })
      createdKeyId = createResponse.json().key.id
    })

    it('should get key details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v2/keys/${createdKeyId}`,
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('key')
      expect(body.key.id).toBe(createdKeyId)
      expect(body.key.name).toBe('Get Test Key')
    })

    it('should return 404 for non-existent key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/keys/non-existent-id',
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v2/keys/${createdKeyId}`
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PUT /api/v2/keys/:id', () => {
    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Update Test Key' }
      })
      createdKeyId = createResponse.json().key.id
    })

    it('should update key name', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v2/keys/${createdKeyId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated Name' }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.key.name).toBe('Updated Name')
    })

    it('should update multiple fields', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v2/keys/${createdKeyId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Multi Update',
          description: 'Updated description',
          isActive: false,
          concurrencyLimit: 10
        }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.key.name).toBe('Multi Update')
      expect(body.key.description).toBe('Updated description')
      expect(body.key.isActive).toBe(false)
      expect(body.key.concurrencyLimit).toBe(10)
    })

    it('should return 404 for non-existent key', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v2/keys/non-existent-id',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated' }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v2/keys/${createdKeyId}`,
        payload: { name: 'Updated' }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('DELETE /api/v2/keys/:id', () => {
    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Delete Test Key' }
      })
      createdKeyId = createResponse.json().key.id
    })

    it('should soft delete key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v2/keys/${createdKeyId}`,
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('message')
    })

    it('should mark key as deleted and inactive', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/api/v2/keys/${createdKeyId}`,
        headers: { authorization: `Bearer ${token}` }
      })

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v2/keys/${createdKeyId}`,
        headers: { authorization: `Bearer ${token}` }
      })

      const key = getResponse.json().key
      expect(key.isDeleted).toBe(true)
      expect(key.isActive).toBe(false)
      expect(key.deletedAt).toBeDefined()
      expect(key.deletedBy).toBe('test-admin')
    })

    it('should return 404 for non-existent key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v2/keys/non-existent-id',
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v2/keys/${createdKeyId}`
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/v2/keys/:id/restore', () => {
    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Restore Test Key' }
      })
      createdKeyId = createResponse.json().key.id

      // Delete the key first
      await app.inject({
        method: 'DELETE',
        url: `/api/v2/keys/${createdKeyId}`,
        headers: { authorization: `Bearer ${token}` }
      })
    })

    it('should restore deleted key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v2/keys/${createdKeyId}/restore`,
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.key.isDeleted).toBe(false)
      expect(body.key.restoredAt).toBeDefined()
      expect(body.key.restoredBy).toBe('test-admin')
    })

    it('should fail for non-deleted key', async () => {
      // First restore it
      await app.inject({
        method: 'POST',
        url: `/api/v2/keys/${createdKeyId}/restore`,
        headers: { authorization: `Bearer ${token}` }
      })

      // Try to restore again
      const response = await app.inject({
        method: 'POST',
        url: `/api/v2/keys/${createdKeyId}/restore`,
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 404 for non-existent key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/keys/non-existent-id/restore',
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v2/keys/${createdKeyId}/restore`
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/v2/keys/:id/stats', () => {
    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v2/keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Stats Test Key' }
      })
      createdKeyId = createResponse.json().key.id
    })

    it('should get key statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v2/keys/${createdKeyId}/stats`,
        headers: { authorization: `Bearer ${token}` }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('stats')
      expect(body.stats).toHaveProperty('total')
      expect(body.stats.total).toHaveProperty('requests')
      expect(body.stats.total).toHaveProperty('tokens')
    })

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v2/keys/${createdKeyId}/stats`
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
