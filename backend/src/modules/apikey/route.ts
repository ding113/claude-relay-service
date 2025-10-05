import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ApiKeyService } from './service'
import type { CreateApiKeyOptions, UpdateApiKeyOptions } from '@/shared/types'

interface CreateKeyRequestBody {
  Body: CreateApiKeyOptions
}

interface UpdateKeyRequestBody {
  Body: UpdateApiKeyOptions
}

interface KeyIdParams {
  Params: {
    id: string
  }
}

interface ListKeysQuerystring {
  Querystring: {
    includeDeleted?: string
    isActive?: string
    permissions?: 'all' | 'claude' | 'codex'
  }
}

export async function apikeyRoutes(fastify: FastifyInstance) {
  const apiKeyService = new ApiKeyService()

  /**
   * POST /api/v2/keys
   * Create a new API Key
   */
  fastify.post<CreateKeyRequestBody>(
    '/api/v2/keys',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            claudeConsoleAccountId: { type: 'string', nullable: true },
            codexAccountId: { type: 'string', nullable: true },
            permissions: { type: 'string', enum: ['all', 'claude', 'codex'] },
            isActive: { type: 'boolean' },
            concurrencyLimit: { type: 'number', minimum: 0 },
            rateLimitWindow: { type: 'number', minimum: 0, nullable: true },
            rateLimitRequests: { type: 'number', minimum: 0, nullable: true },
            rateLimitCost: { type: 'number', minimum: 0, nullable: true },
            enableModelRestriction: { type: 'boolean' },
            restrictedModels: { type: 'array', items: { type: 'string' } },
            enableClientRestriction: { type: 'boolean' },
            allowedClients: { type: 'array', items: { type: 'string' } },
            dailyCostLimit: { type: 'number', minimum: 0 },
            totalCostLimit: { type: 'number', minimum: 0 },
            weeklyOpusCostLimit: { type: 'number', minimum: 0 },
            tags: { type: 'array', items: { type: 'string' } },
            activationDays: { type: 'number', minimum: 0 },
            activationUnit: { type: 'string', enum: ['hours', 'days'] },
            expirationMode: { type: 'string', enum: ['fixed', 'activation'] },
            icon: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              key: { type: 'object' },
              rawKey: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<CreateKeyRequestBody>, reply: FastifyReply) => {
      try {
        const result = await apiKeyService.createApiKey(request.body)

        return reply.send(result)
      } catch (error) {
        request.log.error(error, 'Failed to create API Key')

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to create API Key'
        })
      }
    }
  )

  /**
   * GET /api/v2/keys
   * List API Keys
   */
  fastify.get<ListKeysQuerystring>(
    '/api/v2/keys',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            includeDeleted: { type: 'string', enum: ['true', 'false'] },
            isActive: { type: 'string', enum: ['true', 'false'] },
            permissions: { type: 'string', enum: ['all', 'claude', 'codex'] }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              keys: { type: 'array' },
              total: { type: 'number' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<ListKeysQuerystring>, reply: FastifyReply) => {
      try {
        const { includeDeleted, isActive, permissions } = request.query

        const options: {
          includeDeleted?: boolean
          isActive?: boolean
          permissions?: 'all' | 'claude' | 'codex'
        } = {}

        if (includeDeleted !== undefined) {
          options.includeDeleted = includeDeleted === 'true'
        }

        if (isActive !== undefined) {
          options.isActive = isActive === 'true'
        }

        if (permissions) {
          options.permissions = permissions
        }

        const keys = await apiKeyService.listApiKeys(options)

        return reply.send({
          keys,
          total: keys.length
        })
      } catch (error) {
        request.log.error(error, 'Failed to list API Keys')

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list API Keys'
        })
      }
    }
  )

  /**
   * GET /api/v2/keys/:id
   * Get API Key details
   */
  fastify.get<KeyIdParams>(
    '/api/v2/keys/:id',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              key: { type: 'object' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<KeyIdParams>, reply: FastifyReply) => {
      try {
        const { id } = request.params

        const key = await apiKeyService.getApiKey(id)

        if (!key) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'API Key not found'
          })
        }

        return reply.send({ key })
      } catch (error) {
        request.log.error(error, 'Failed to get API Key')

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get API Key'
        })
      }
    }
  )

  /**
   * PUT /api/v2/keys/:id
   * Update API Key
   */
  fastify.put<KeyIdParams & UpdateKeyRequestBody>(
    '/api/v2/keys/:id',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 }
          }
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
            isActive: { type: 'boolean' },
            expiresAt: { type: 'string', format: 'date-time' },
            claudeConsoleAccountId: { type: 'string', nullable: true },
            codexAccountId: { type: 'string', nullable: true },
            permissions: { type: 'string', enum: ['all', 'claude', 'codex'] },
            concurrencyLimit: { type: 'number', minimum: 0 },
            rateLimitWindow: { type: 'number', minimum: 0 },
            rateLimitRequests: { type: 'number', minimum: 0 },
            rateLimitCost: { type: 'number', minimum: 0 },
            enableModelRestriction: { type: 'boolean' },
            restrictedModels: { type: 'array', items: { type: 'string' } },
            enableClientRestriction: { type: 'boolean' },
            allowedClients: { type: 'array', items: { type: 'string' } },
            dailyCostLimit: { type: 'number', minimum: 0 },
            totalCostLimit: { type: 'number', minimum: 0 },
            weeklyOpusCostLimit: { type: 'number', minimum: 0 },
            tags: { type: 'array', items: { type: 'string' } },
            activationDays: { type: 'number', minimum: 0 },
            activationUnit: { type: 'string', enum: ['hours', 'days'] },
            expirationMode: { type: 'string', enum: ['fixed', 'activation'] },
            isActivated: { type: 'boolean' },
            activatedAt: { type: 'string', format: 'date-time' },
            icon: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              key: { type: 'object' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<KeyIdParams & UpdateKeyRequestBody>, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const updates = request.body

        const key = await apiKeyService.updateApiKey(id, updates)

        return reply.send({ key })
      } catch (error) {
        request.log.error(error, 'Failed to update API Key')

        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500

        return reply.status(statusCode).send({
          error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to update API Key'
        })
      }
    }
  )

  /**
   * DELETE /api/v2/keys/:id
   * Soft delete API Key
   */
  fastify.delete<KeyIdParams>(
    '/api/v2/keys/:id',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<KeyIdParams>, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const deletedBy = request.user?.username || 'admin'

        await apiKeyService.deleteApiKey(id, deletedBy)

        return reply.send({
          message: 'API Key deleted successfully'
        })
      } catch (error) {
        request.log.error(error, 'Failed to delete API Key')

        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500

        return reply.status(statusCode).send({
          error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to delete API Key'
        })
      }
    }
  )

  /**
   * POST /api/v2/keys/:id/restore
   * Restore deleted API Key
   */
  fastify.post<KeyIdParams>(
    '/api/v2/keys/:id/restore',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              key: { type: 'object' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<KeyIdParams>, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const restoredBy = request.user?.username || 'admin'

        const key = await apiKeyService.restoreApiKey(id, restoredBy)

        return reply.send({ key })
      } catch (error) {
        request.log.error(error, 'Failed to restore API Key')

        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 400

        return reply.status(statusCode).send({
          error: statusCode === 404 ? 'Not Found' : 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to restore API Key'
        })
      }
    }
  )

  /**
   * GET /api/v2/keys/:id/stats
   * Get API Key usage statistics
   */
  fastify.get<KeyIdParams>(
    '/api/v2/keys/:id/stats',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              stats: { type: 'object' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<KeyIdParams>, reply: FastifyReply) => {
      try {
        const { id } = request.params

        const stats = await apiKeyService.getApiKeyStats(id)

        return reply.send({ stats })
      } catch (error) {
        request.log.error(error, 'Failed to get API Key stats')

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get API Key stats'
        })
      }
    }
  )
}
