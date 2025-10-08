/**
 * Account Routes
 * 账户管理 API 端点
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { AccountService } from './service'
import type {
  AccountPlatform,
  AccountType,
  CreateAccountOptions,
  UpdateAccountOptions
} from '@/shared/types'

interface PlatformParams {
  Params: {
    platform: AccountPlatform
  }
}

interface AccountIdParams {
  Params: {
    platform: AccountPlatform
    id: string
  }
}

interface CreateAccountBody {
  Body: CreateAccountOptions
}

interface UpdateAccountBody {
  Body: UpdateAccountOptions
}

interface ToggleSchedulableBody {
  Body: {
    schedulable: boolean
  }
}

interface ListAccountsQuery {
  Querystring: {
    isActive?: string
    schedulable?: string
    accountType?: AccountType
  }
}

export async function accountRoutes(fastify: FastifyInstance) {
  const accountService = new AccountService()

  /**
   * GET /api/v2/accounts/:platform
   * List accounts for a specific platform
   */
  fastify.get<PlatformParams & ListAccountsQuery>(
    '/api/v2/accounts/:platform',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'List all accounts for a specific platform (claude-console or codex) with optional filters',
        tags: ['Accounts'],
        summary: 'List Accounts',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['platform'],
          properties: {
            platform: {
              type: 'string',
              enum: ['claude-console', 'codex'],
              description: 'Platform type'
            }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            isActive: {
              type: 'string',
              enum: ['true', 'false'],
              description: 'Filter by active status'
            },
            schedulable: {
              type: 'string',
              enum: ['true', 'false'],
              description: 'Filter by schedulable status'
            },
            accountType: {
              type: 'string',
              enum: ['dedicated', 'shared'],
              description: 'Filter by account type'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accounts: { type: 'array', items: { type: 'object', additionalProperties: true } },
              total: { type: 'number' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<PlatformParams & ListAccountsQuery>, reply: FastifyReply) => {
      try {
        const { platform } = request.params
        const { isActive, schedulable, accountType } = request.query

        const filters: any = {}

        if (isActive !== undefined) {
          filters.isActive = isActive === 'true'
        }

        if (schedulable !== undefined) {
          filters.schedulable = schedulable === 'true'
        }

        if (accountType) {
          filters.accountType = accountType
        }

        const accounts = await accountService.listAccounts(platform, filters)

        return reply.send({
          accounts,
          total: accounts.length
        })
      } catch (error) {
        request.log.error(error, 'Failed to list accounts')

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list accounts'
        })
      }
    }
  )

  /**
   * POST /api/v2/accounts/:platform
   * Create a new account
   */
  fastify.post<PlatformParams & CreateAccountBody>(
    '/api/v2/accounts/:platform',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Create a new account for Claude Console or Codex platform with API credentials and configuration',
        tags: ['Accounts'],
        summary: 'Create Account',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['platform'],
          properties: {
            platform: {
              type: 'string',
              enum: ['claude-console', 'codex']
            }
          }
        },
        body: {
          type: 'object',
          required: ['apiUrl', 'apiKey'],
          properties: {
            name: { type: 'string', maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
            apiUrl: { type: 'string', format: 'uri' },
            apiKey: { type: 'string', minLength: 1 },
            userAgent: { type: 'string' },
            priority: { type: 'number', minimum: 1, maximum: 100 },
            supportedModels: {
              oneOf: [
                {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                  description: 'Model mapping object'
                },
                {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of supported model names'
                }
              ]
            },
            rateLimitDuration: { type: 'number', minimum: 0 },
            proxy: {
              type: 'object',
              required: ['protocol', 'host', 'port'],
              properties: {
                protocol: { type: 'string', enum: ['http', 'https', 'socks5'] },
                host: { type: 'string' },
                port: { type: 'number', minimum: 1, maximum: 65535 },
                auth: {
                  type: 'object',
                  properties: {
                    username: { type: 'string' },
                    password: { type: 'string' }
                  }
                }
              },
              nullable: true
            },
            isActive: { type: 'boolean' },
            accountType: { type: 'string', enum: ['dedicated', 'shared'] },
            schedulable: { type: 'boolean' },
            dailyQuota: { type: 'number', minimum: 0 },
            quotaResetTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              account: { type: 'object', additionalProperties: true }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<PlatformParams & CreateAccountBody>, reply: FastifyReply) => {
      try {
        const { platform } = request.params
        const options = request.body

        const account = await accountService.createAccount(platform, options)

        return reply.status(201).send({ account })
      } catch (error) {
        request.log.error(error, 'Failed to create account')

        const statusCode = error instanceof Error && error.message.includes('required') ? 400 : 500

        return reply.status(statusCode).send({
          error: statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to create account'
        })
      }
    }
  )

  /**
   * GET /api/v2/accounts/:platform/:id
   * Get account details
   */
  fastify.get<AccountIdParams>(
    '/api/v2/accounts/:platform/:id',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Get detailed information about a specific account including configuration and status',
        tags: ['Accounts'],
        summary: 'Get Account Details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['platform', 'id'],
          properties: {
            platform: { type: 'string', enum: ['claude-console', 'codex'] },
            id: { type: 'string', minLength: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              account: { type: 'object', additionalProperties: true }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<AccountIdParams>, reply: FastifyReply) => {
      try {
        const { platform, id } = request.params

        const account = await accountService.getAccount(platform, id)

        if (!account) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Account not found'
          })
        }

        return reply.send({ account })
      } catch (error) {
        request.log.error(error, 'Failed to get account')

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get account'
        })
      }
    }
  )

  /**
   * PUT /api/v2/accounts/:platform/:id
   * Update account configuration
   */
  fastify.put<AccountIdParams & UpdateAccountBody>(
    '/api/v2/accounts/:platform/:id',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Update account configuration including credentials, proxy, model mapping, and scheduling settings',
        tags: ['Accounts'],
        summary: 'Update Account',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['platform', 'id'],
          properties: {
            platform: { type: 'string', enum: ['claude-console', 'codex'] },
            id: { type: 'string', minLength: 1 }
          }
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
            apiUrl: { type: 'string', format: 'uri' },
            apiKey: { type: 'string', minLength: 1 },
            userAgent: { type: 'string' },
            priority: { type: 'number', minimum: 1, maximum: 100 },
            supportedModels: {
              oneOf: [
                { type: 'object', additionalProperties: { type: 'string' } },
                { type: 'array', items: { type: 'string' } }
              ]
            },
            rateLimitDuration: { type: 'number', minimum: 0 },
            proxy: {
              type: 'object',
              properties: {
                protocol: { type: 'string', enum: ['http', 'https', 'socks5'] },
                host: { type: 'string' },
                port: { type: 'number', minimum: 1, maximum: 65535 },
                auth: {
                  type: 'object',
                  properties: {
                    username: { type: 'string' },
                    password: { type: 'string' }
                  }
                }
              },
              nullable: true
            },
            isActive: { type: 'boolean' },
            schedulable: { type: 'boolean' },
            dailyQuota: { type: 'number', minimum: 0 },
            dailyUsage: { type: 'number', minimum: 0 },
            lastResetDate: { type: 'string' },
            quotaStoppedAt: { type: 'string' },
            status: {
              type: 'string',
              enum: ['active', 'error', 'rate_limited', 'unauthorized', 'overloaded', 'blocked', 'quota_exceeded', 'temp_error']
            },
            errorMessage: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              account: { type: 'object', additionalProperties: true }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<AccountIdParams & UpdateAccountBody>, reply: FastifyReply) => {
      try {
        const { platform, id } = request.params
        const updates = request.body

        const account = await accountService.updateAccount(platform, id, updates)

        return reply.send({ account })
      } catch (error) {
        request.log.error(error, 'Failed to update account')

        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500

        return reply.status(statusCode).send({
          error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to update account'
        })
      }
    }
  )

  /**
   * DELETE /api/v2/accounts/:platform/:id
   * Delete account
   */
  fastify.delete<AccountIdParams>(
    '/api/v2/accounts/:platform/:id',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Permanently delete an account and all its associated data',
        tags: ['Accounts'],
        summary: 'Delete Account',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['platform', 'id'],
          properties: {
            platform: { type: 'string', enum: ['claude-console', 'codex'] },
            id: { type: 'string', minLength: 1 }
          }
        },
        response: {
          204: {
            description: 'Account deleted successfully'
          }
        }
      }
    },
    async (request: FastifyRequest<AccountIdParams>, reply: FastifyReply) => {
      try {
        const { platform, id } = request.params

        await accountService.deleteAccount(platform, id)

        return reply.status(204).send()
      } catch (error) {
        request.log.error(error, 'Failed to delete account')

        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500

        return reply.status(statusCode).send({
          error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to delete account'
        })
      }
    }
  )

  /**
   * POST /api/v2/accounts/:platform/:id/toggle-schedulable
   * Toggle account schedulable status
   */
  fastify.post<AccountIdParams & ToggleSchedulableBody>(
    '/api/v2/accounts/:platform/:id/toggle-schedulable',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Enable or disable account scheduling for load balancing and request routing',
        tags: ['Accounts'],
        summary: 'Toggle Schedulable Status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['platform', 'id'],
          properties: {
            platform: { type: 'string', enum: ['claude-console', 'codex'] },
            id: { type: 'string', minLength: 1 }
          }
        },
        body: {
          type: 'object',
          required: ['schedulable'],
          properties: {
            schedulable: { type: 'boolean' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              account: { type: 'object', additionalProperties: true }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<AccountIdParams & ToggleSchedulableBody>, reply: FastifyReply) => {
      try {
        const { platform, id } = request.params
        const { schedulable } = request.body

        const account = await accountService.toggleSchedulable(platform, id, schedulable)

        return reply.send({ account })
      } catch (error) {
        request.log.error(error, 'Failed to toggle schedulable')

        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500

        return reply.status(statusCode).send({
          error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to toggle schedulable'
        })
      }
    }
  )

  /**
   * POST /api/v2/accounts/:platform/:id/reset-rate-limit
   * Reset account rate limit status
   */
  fastify.post<AccountIdParams>(
    '/api/v2/accounts/:platform/:id/reset-rate-limit',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Clear rate limit status and allow account to be used again immediately',
        tags: ['Accounts'],
        summary: 'Reset Rate Limit',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['platform', 'id'],
          properties: {
            platform: { type: 'string', enum: ['claude-console', 'codex'] },
            id: { type: 'string', minLength: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              account: { type: 'object', additionalProperties: true },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<AccountIdParams>, reply: FastifyReply) => {
      try {
        const { platform, id } = request.params

        const account = await accountService.resetRateLimit(platform, id)

        return reply.send({
          account,
          message: 'Rate limit reset successfully'
        })
      } catch (error) {
        request.log.error(error, 'Failed to reset rate limit')

        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500

        return reply.status(statusCode).send({
          error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to reset rate limit'
        })
      }
    }
  )

  /**
   * GET /api/v2/accounts/:platform/:id/availability
   * Check account availability for scheduling
   */
  fastify.get<AccountIdParams>(
    '/api/v2/accounts/:platform/:id/availability',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Check if account is available for scheduling based on status, quota, and rate limits',
        tags: ['Accounts'],
        summary: 'Check Account Availability',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['platform', 'id'],
          properties: {
            platform: { type: 'string', enum: ['claude-console', 'codex'] },
            id: { type: 'string', minLength: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              available: { type: 'boolean' },
              reason: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<AccountIdParams>, reply: FastifyReply) => {
      try {
        const { platform, id } = request.params

        const account = await accountService.getAccount(platform, id)

        if (!account) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Account not found'
          })
        }

        const availability = accountService.checkAvailability(account)

        return reply.send({
          available: availability.available,
          reason: availability.reason
        })
      } catch (error) {
        request.log.error(error, 'Failed to check availability')

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to check availability'
        })
      }
    }
  )
}

export default fp(accountRoutes)
