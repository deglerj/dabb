/**
 * Structured logging with pino
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

// Child loggers for different components
export const dbLogger = logger.child({ component: 'database' });
export const socketLogger = logger.child({ component: 'socket' });
export const apiLogger = logger.child({ component: 'api' });
export const gameLogger = logger.child({ component: 'game' });

export default logger;
