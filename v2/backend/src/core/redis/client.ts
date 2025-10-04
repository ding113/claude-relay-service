import Redis from 'ioredis'
import { config } from '../config'
import logger from '../logger'

class RedisClient {
  private client: Redis | null = null
  private isConnected = false

  async connect(): Promise<Redis> {
    if (this.client && this.isConnected) {
      return this.client
    }

    try {
      this.client = new Redis({
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD || undefined,
        db: config.REDIS_DB,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000)
          return delay
        },
        tls: config.REDIS_ENABLE_TLS ? {} : undefined,
        lazyConnect: true
      })

      this.client.on('connect', () => {
        this.isConnected = true
        logger.info(`🔗 Redis connected successfully (DB: ${config.REDIS_DB})`)
      })

      this.client.on('error', (err) => {
        this.isConnected = false
        logger.error({ err }, '❌ Redis connection error')
      })

      this.client.on('close', () => {
        this.isConnected = false
        logger.warn('⚠️  Redis connection closed')
      })

      await this.client.connect()
      return this.client
    } catch (error) {
      logger.error({ error }, '💥 Failed to connect to Redis')
      throw error
    }
  }

  getClient(): Redis {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected. Call connect() first.')
    }
    return this.client
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.isConnected = false
      logger.info('👋 Redis disconnected')
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.getClient().ping()
      return result === 'PONG'
    } catch {
      return false
    }
  }
}

export const redisClient = new RedisClient()
export default redisClient
