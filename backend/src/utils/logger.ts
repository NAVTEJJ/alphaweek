import winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'alphaweek-api' },
  transports: [
    new winston.transports.Console({
      format: isDev ? combine(colorize(), simple()) : combine(timestamp(), json()),
    }),
  ],
});

// Request-scoped logger — attaches request_id to every log in a request
export function requestLogger(requestId: string): winston.Logger {
  return logger.child({ requestId });
}
