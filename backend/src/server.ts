import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { config, isDev } from './core/config'
import logger from './core/logger'
import redisClient from './core/redis/client'
import { registerJWT } from './core/plugins/jwt'
import { healthRoutes } from './modules/health/route'
import { authRoutes } from './modules/auth/route'
import { apikeyRoutes } from './modules/apikey/route'

const fastify = Fastify({
  logger: isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
          }
        },
        level: config.LOG_LEVEL
      }
    : {
        level: config.LOG_LEVEL
      },
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  trustProxy: true
})

// Register plugins
fastify.register(cors, {
  origin: isDev ? true : false,
  credentials: true
})

fastify.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
})

// Register JWT plugin
fastify.register(registerJWT)

// Register routes
fastify.register(healthRoutes)
fastify.register(authRoutes)
fastify.register(apikeyRoutes)

// Graceful shutdown
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, starting graceful shutdown...`)

    try {
      await fastify.close()
      logger.info('HTTP server closed')

      await redisClient.disconnect()
      logger.info('Graceful shutdown completed')

      process.exit(0)
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })
})

// Start server
const start = async () => {
  try {
    // Connect to Redis
    logger.info('Connecting to Redis...')
    await redisClient.connect()

    // Start HTTP server
    await fastify.listen({
      port: config.PORT,
      host: config.HOST
    })

    logger.info(`v2 Backend started on ${config.HOST}:${config.PORT}`)
    logger.info(`Environment: ${config.NODE_ENV}`)
    logger.info(`Health check: http://${config.HOST}:${config.PORT}/health`)
  } catch (error) {
    logger.error(error)
    process.exit(1)
  }
}

start()
