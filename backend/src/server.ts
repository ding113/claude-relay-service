import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { config, isDev } from './core/config'
import logger from './core/logger'
import redisClient from './core/redis/client'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { registerJWT } from './core/plugins/jwt'
import healthRoutes from './modules/health/route'
import authRoutes from './modules/auth/route'
import apikeyRoutes from './modules/apikey/route'
import accountRoutes from './modules/account/route'

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
    // Connect to Redis FIRST (authRoutes initialization needs it)
    logger.info('Connecting to Redis...')
    await redisClient.connect()

    // Register plugins with await to ensure proper order
    logger.info('Registering plugins...')

    await fastify.register(cors, {
      origin: isDev ? true : false,
      credentials: true
    })

    await fastify.register(helmet, {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })

    // Register JWT plugin
    await fastify.register(registerJWT)

    // Register Swagger directly (MUST complete before routes)
    await fastify.register(swagger, {
      mode: 'dynamic',
      openapi: {
        info: {
          title: 'Claude Relay Service v2 API',
          description: 'Enterprise-grade AI API Gateway',
          version: '2.0.0'
        },
        servers: [{ url: `http://${config.HOST}:${config.PORT}`, description: 'Development' }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
        },
        tags: [
          { name: 'Health', description: 'Health check' },
          { name: 'Authentication', description: 'Admin auth' },
          { name: 'API Keys', description: 'API Key management' },
          { name: 'Accounts', description: 'Account management' }
        ]
      }
    })

    await fastify.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true
      }
    })

    // Register routes (Swagger onRoute hook is now ready)
    await fastify.register(healthRoutes)
    await fastify.register(authRoutes)
    await fastify.register(apikeyRoutes)
    await fastify.register(accountRoutes)

    // Wait for all plugins and routes to load
    await fastify.ready()
    logger.info('All plugins and routes loaded')

    // Start HTTP server
    await fastify.listen({
      port: config.PORT,
      host: config.HOST
    })

    logger.info(`v2 Backend started on ${config.HOST}:${config.PORT}`)
    logger.info(`Environment: ${config.NODE_ENV}`)
    logger.info(`Health check: http://${config.HOST}:${config.PORT}/health`)
    logger.info(`Swagger docs: http://${config.HOST}:${config.PORT}/docs`)
  } catch (error) {
    logger.error(error)
    process.exit(1)
  }
}

start()
