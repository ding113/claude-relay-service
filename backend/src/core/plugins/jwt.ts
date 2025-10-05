import { FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { config } from '@/core/config'
import { JWTPayload } from '@/shared/types'

export async function registerJWT(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: `${config.ADMIN_SESSION_TIMEOUT}ms`
    }
  })

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      })
    }
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JWTPayload
  }
}
