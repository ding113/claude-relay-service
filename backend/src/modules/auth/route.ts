import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AuthService } from './service'
import { LoginRequest } from '@/shared/types'

interface LoginRequestBody {
  Body: LoginRequest
}

interface ChangePasswordRequestBody {
  Body: {
    currentPassword: string
    newPassword: string
  }
}

export async function authRoutes(fastify: FastifyInstance) {
  // Initialize admin on startup
  const authService = new AuthService(fastify)
  await authService.initializeAdmin()

  /**
   * POST /api/v2/auth/admin/login
   * Admin login
   */
  fastify.post<LoginRequestBody>(
    '/api/v2/auth/admin/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              expiresIn: { type: 'number' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<LoginRequestBody>, reply: FastifyReply) => {
      try {
        const { username, password } = request.body

        const result = await authService.login(username, password)

        return reply.send(result)
      } catch (error) {
        request.log.error(error, 'Login failed')

        return reply.status(401).send({
          error: 'Unauthorized',
          message: error instanceof Error ? error.message : 'Login failed'
        })
      }
    }
  )

  /**
   * GET /api/v2/auth/me
   * Get current user info (protected)
   */
  fastify.get(
    '/api/v2/auth/me',
    {
      preHandler: fastify.authenticate,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              role: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = authService.getCurrentUser(request.user)

        return reply.send(user)
      } catch (error) {
        request.log.error(error, 'Failed to get current user')

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get current user'
        })
      }
    }
  )

  /**
   * POST /api/v2/auth/change-password
   * Change admin password (protected)
   */
  fastify.post<ChangePasswordRequestBody>(
    '/api/v2/auth/change-password',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', minLength: 1 },
            newPassword: { type: 'string', minLength: 8 }
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
    async (request: FastifyRequest<ChangePasswordRequestBody>, reply: FastifyReply) => {
      try {
        const { currentPassword, newPassword } = request.body

        await authService.changePassword(currentPassword, newPassword)

        return reply.send({
          message: 'Password changed successfully'
        })
      } catch (error) {
        request.log.error(error, 'Password change failed')

        return reply.status(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Password change failed'
        })
      }
    }
  )
}
