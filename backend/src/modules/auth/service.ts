import { FastifyInstance } from 'fastify'
import { config } from '@/core/config'
import logger from '@/core/logger'
import adminRepository from '@/core/redis/repositories/admin.repository'
import { hashPassword, verifyPassword, generatePassword } from '@/core/utils/password'
import { JWTPayload, LoginResponse, AuthenticatedUser } from '@/shared/types'

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Initialize admin credentials if not exists
   */
  async initializeAdmin(): Promise<void> {
    const exists = await adminRepository.exists()

    if (exists) {
      logger.info('Admin credentials already exist')
      return
    }

    // Use environment variables or generate random password
    const username = config.ADMIN_USERNAME || 'cr_admin'
    const password = config.ADMIN_PASSWORD || generatePassword(20)

    const passwordHash = await hashPassword(password)
    await adminRepository.setCredentials(username, passwordHash)

    // Log credentials only if auto-generated
    if (!config.ADMIN_PASSWORD) {
      logger.warn(
        {
          username,
          password,
          message:
            'Admin credentials auto-generated. Please save this password and change it after first login.'
        },
        'Admin credentials initialized'
      )
    } else {
      logger.info({ username }, 'Admin credentials initialized from environment')
    }
  }

  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const credentials = await adminRepository.getCredentials()

      if (!credentials) {
        throw new Error('Admin credentials not found')
      }

      if (credentials.username !== username) {
        throw new Error('Invalid username or password')
      }

      const isValid = await verifyPassword(password, credentials.passwordHash)

      if (!isValid) {
        throw new Error('Invalid username or password')
      }

      const payload: JWTPayload = {
        username: credentials.username,
        role: 'admin'
      }

      const token = this.fastify.jwt.sign(payload)
      const expiresIn = config.ADMIN_SESSION_TIMEOUT

      logger.info({ username }, 'Admin logged in')

      return {
        token,
        expiresIn
      }
    } catch (error) {
      logger.error({ error, username }, 'Login failed')
      throw error
    }
  }

  /**
   * Verify JWT token and return user info
   */
  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = this.fastify.jwt.verify<JWTPayload>(token)

      return {
        username: payload.username,
        role: payload.role
      }
    } catch (error) {
      logger.error({ error }, 'Token verification failed')
      throw new Error('Invalid or expired token')
    }
  }

  /**
   * Get current user from request
   */
  getCurrentUser(payload: JWTPayload): AuthenticatedUser {
    return {
      username: payload.username,
      role: payload.role
    }
  }

  /**
   * Change admin password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const credentials = await adminRepository.getCredentials()

      if (!credentials) {
        throw new Error('Admin credentials not found')
      }

      const isValid = await verifyPassword(currentPassword, credentials.passwordHash)

      if (!isValid) {
        throw new Error('Current password is incorrect')
      }

      const newPasswordHash = await hashPassword(newPassword)
      await adminRepository.updateCredentials(credentials.username, newPasswordHash)

      logger.info({ username: credentials.username }, 'Admin password changed')
    } catch (error) {
      logger.error({ error }, 'Password change failed')
      throw error
    }
  }
}
