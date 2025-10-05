import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import redisClient from '@/core/redis/client'
import { config } from '@/core/config'

interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  service: string
  version: string
  timestamp: string
  uptime: number
  environment: string
  components: {
    redis: {
      status: string
      connected: boolean
      db: number
    }
  }
}

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', {
    schema: {
      description: 'Check service health status including Redis connection',
      tags: ['Health'],
      summary: 'Health Check',
      response: {
        200: {
          description: 'Service is healthy',
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'] },
            service: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            environment: { type: 'string' },
            components: {
              type: 'object',
              properties: {
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    connected: { type: 'boolean' },
                    db: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        503: {
          description: 'Service is unhealthy',
          type: 'object',
          properties: {
            status: { type: 'string' },
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check Redis connection
      const redisConnected = await redisClient.ping()

      const health: HealthResponse = {
        status: redisConnected ? 'healthy' : 'unhealthy',
        service: 'claude-relay-service-v2',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.NODE_ENV,
        components: {
          redis: {
            status: redisConnected ? 'healthy' : 'unhealthy',
            connected: redisConnected,
            db: config.REDIS_DB
          }
        }
      }

      const statusCode = health.status === 'healthy' ? 200 : 503

      return reply.code(statusCode).send(health)
    } catch (error) {
      request.log.error(error, 'Health check failed')

      return reply.code(503).send({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })
}
