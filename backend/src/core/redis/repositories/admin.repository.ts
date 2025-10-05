import type { Redis } from 'ioredis'
import redisClient from '../client'
import logger from '@/core/logger'
import { AdminCredentials } from '@/shared/types'
import { REDIS_KEYS } from '@/shared/types/redis-keys'

export class AdminRepository {
  private redis: Redis | null = null

  constructor(redis?: Redis) {
    if (redis) {
      this.redis = redis
    }
  }

  private getClient(): Redis {
    if (this.redis) {
      return this.redis
    }
    return redisClient.getClient()
  }
  /**
   * Get admin credentials
   */
  async getCredentials(): Promise<AdminCredentials | null> {
    try {
      const data = await this.getClient().get(REDIS_KEYS.ADMIN_CREDENTIALS)

      if (!data) {
        return null
      }

      return JSON.parse(data)
    } catch (error) {
      logger.error({ error }, 'Failed to get admin credentials')
      throw error
    }
  }

  /**
   * Set admin credentials
   */
  async setCredentials(username: string, passwordHash: string): Promise<void> {
    try {
      const credentials: AdminCredentials = {
        username,
        passwordHash,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await this.getClient().set(REDIS_KEYS.ADMIN_CREDENTIALS, JSON.stringify(credentials))

      logger.info({ username }, 'Admin credentials saved')
    } catch (error) {
      logger.error({ error, username }, 'Failed to set admin credentials')
      throw error
    }
  }

  /**
   * Update admin credentials
   */
  async updateCredentials(username: string, passwordHash: string): Promise<void> {
    try {
      const existing = await this.getCredentials()

      if (!existing) {
        throw new Error('Admin credentials not found')
      }

      const credentials: AdminCredentials = {
        ...existing,
        username,
        passwordHash,
        updatedAt: Date.now()
      }

      await this.getClient().set(REDIS_KEYS.ADMIN_CREDENTIALS, JSON.stringify(credentials))

      logger.info({ username }, 'Admin credentials updated')
    } catch (error) {
      logger.error({ error, username }, 'Failed to update admin credentials')
      throw error
    }
  }

  /**
   * Check if admin credentials exist
   */
  async exists(): Promise<boolean> {
    try {
      const exists = await this.getClient().exists(REDIS_KEYS.ADMIN_CREDENTIALS)
      return exists === 1
    } catch (error) {
      logger.error({ error }, 'Failed to check admin credentials existence')
      throw error
    }
  }

  /**
   * Delete admin credentials
   */
  async delete(): Promise<void> {
    try {
      await this.getClient().del(REDIS_KEYS.ADMIN_CREDENTIALS)
      logger.warn('Admin credentials deleted')
    } catch (error) {
      logger.error({ error }, 'Failed to delete admin credentials')
      throw error
    }
  }
}

export default new AdminRepository()
