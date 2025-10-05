import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { config } from '@/core/config'

export async function registerSwagger(fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Claude Relay Service v2 API',
        description: 'Enterprise-grade AI API Gateway with multi-account management and intelligent request routing',
        version: '2.0.0',
        contact: {
          name: 'API Support',
          url: 'https://github.com/anthropics/claude-relay-service'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: `http://${config.HOST}:${config.PORT}`,
          description: 'Development Server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT Bearer token obtained from admin login'
          }
        }
      },
      tags: [
        {
          name: 'Health',
          description: 'Service health check endpoints'
        },
        {
          name: 'Authentication',
          description: 'Admin authentication and session management'
        },
        {
          name: 'API Keys',
          description: 'API Key CRUD operations and usage statistics'
        }
      ]
    }
  })

  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => {
      return swaggerObject
    },
    transformSpecificationClone: true
  })
}
