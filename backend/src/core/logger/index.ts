import pino from 'pino'
import { config } from '../config'

const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.LOG_PRETTY
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    : undefined
})

export default logger
export { logger }
