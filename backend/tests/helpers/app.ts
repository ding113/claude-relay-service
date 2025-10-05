/**
 * Test helper for building Fastify app instance
 * Used in integration tests
 */

import Fastify, { FastifyInstance } from 'fastify'
import { registerJWT } from '@/core/plugins/jwt'
import { healthRoutes } from '@/modules/health/route'
import { authRoutes } from '@/modules/auth/route'
import { apikeyRoutes } from '@/modules/apikey/route'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false // Disable logging in tests
  })

  // Register JWT plugin
  await app.register(registerJWT)

  // Register routes
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(apikeyRoutes)

  // Wait for the app to be ready
  await app.ready()

  return app
}

/**
 * Generate a test JWT token for authenticated requests
 */
export function generateTestToken(app: FastifyInstance, payload = { username: 'test-admin', role: 'admin' as const }) {
  return app.jwt.sign(payload)
}
