/**
 * Auth Routes Integration Tests
 * Tests HTTP layer endpoints for authentication
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
import { hashPassword } from '@/core/utils/password'
import { REDIS_KEYS } from '@/shared/types'

describe('Auth Routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    await mockRedis.flushall()
    app = await buildApp()

    // Setup test admin credentials
    const passwordHash = await hashPassword('test-password-123')
    await mockRedis.set(
      REDIS_KEYS.ADMIN_CREDENTIALS,
      JSON.stringify({
        username: 'test-admin',
        passwordHash,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    )
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/v2/auth/admin/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/admin/login',
        payload: {
          username: 'test-admin',
          password: 'test-password-123'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('token')
      expect(body).toHaveProperty('expiresIn')
      expect(typeof body.token).toBe('string')
      expect(typeof body.expiresIn).toBe('number')
    })

    it('should fail with incorrect username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/admin/login',
        payload: {
          username: 'wrong-user',
          password: 'test-password-123'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body).toHaveProperty('error')
      expect(body).toHaveProperty('message')
    })

    it('should fail with incorrect password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/admin/login',
        payload: {
          username: 'test-admin',
          password: 'wrong-password'
        }
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body).toHaveProperty('error')
    })

    it('should fail with missing username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/admin/login',
        payload: {
          password: 'test-password-123'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should fail with missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/admin/login',
        payload: {
          username: 'test-admin'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return valid JWT payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/admin/login',
        payload: {
          username: 'test-admin',
          password: 'test-password-123'
        }
      })

      const body = response.json()
      const decoded = app.jwt.verify(body.token)

      expect(decoded).toHaveProperty('username', 'test-admin')
      expect(decoded).toHaveProperty('role', 'admin')
    })
  })

  describe('GET /api/v2/auth/me', () => {
    it('should return current user with valid token', async () => {
      const token = generateTestToken(app, { username: 'test-admin', role: 'admin' })

      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/auth/me',
        headers: {
          authorization: `Bearer ${token}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('username', 'test-admin')
      expect(body).toHaveProperty('role', 'admin')
    })

    it('should fail without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/auth/me'
      })

      expect(response.statusCode).toBe(401)
    })

    it('should fail with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/auth/me',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should fail with malformed authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/auth/me',
        headers: {
          authorization: 'InvalidFormat'
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/v2/auth/change-password', () => {
    beforeEach(async () => {
      // Ensure admin credentials exist
      const passwordHash = await hashPassword('current-password')
      await mockRedis.set(
        REDIS_KEYS.ADMIN_CREDENTIALS,
        JSON.stringify({
          username: 'test-admin',
          passwordHash,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      )
    })

    it('should change password with correct current password', async () => {
      const token = generateTestToken(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          currentPassword: 'current-password',
          newPassword: 'new-secure-password-123'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('message')
    })

    it('should fail with incorrect current password', async () => {
      const token = generateTestToken(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          currentPassword: 'wrong-password',
          newPassword: 'new-secure-password-123'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/change-password',
        payload: {
          currentPassword: 'current-password',
          newPassword: 'new-secure-password-123'
        }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should fail with short new password', async () => {
      const token = generateTestToken(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          currentPassword: 'current-password',
          newPassword: 'short'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should fail with missing current password', async () => {
      const token = generateTestToken(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          newPassword: 'new-secure-password-123'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should fail with missing new password', async () => {
      const token = generateTestToken(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          currentPassword: 'current-password'
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
