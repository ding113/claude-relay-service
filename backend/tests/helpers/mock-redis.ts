/**
 * Redis mocking utilities for integration tests
 */

import { vi } from 'vitest'
import type Redis from 'ioredis'

/**
 * Setup Redis client mock with a provided Redis Mock instance
 */
export function setupRedisMock(redis: Redis) {
  // Mock the redisClient module
  vi.mock('@/core/redis/client', () => ({
    redisClient: {
      connect: vi.fn().mockResolvedValue(redis),
      getClient: vi.fn().mockReturnValue(redis),
      disconnect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue(true)
    },
    default: {
      connect: vi.fn().mockResolvedValue(redis),
      getClient: vi.fn().mockReturnValue(redis),
      disconnect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue(true)
    }
  }))

  // Mock repositories to use the provided Redis instance
  vi.mock('@/core/redis/repositories/admin.repository', async () => {
    const { AdminRepository } = await vi.importActual('@/core/redis/repositories/admin.repository') as any
    return {
      default: new AdminRepository(redis),
      AdminRepository
    }
  })

  vi.mock('@/core/redis/repositories/apikey.repository', async () => {
    const { createApiKeyRepository } = await vi.importActual('@/core/redis/repositories/apikey.repository') as any
    return {
      createApiKeyRepository: () => createApiKeyRepository(redis)
    }
  })

  vi.mock('@/core/redis/repositories/usage.repository', async () => {
    const { createUsageRepository } = await vi.importActual('@/core/redis/repositories/usage.repository') as any
    return {
      createUsageRepository: () => createUsageRepository(redis)
    }
  })
}
