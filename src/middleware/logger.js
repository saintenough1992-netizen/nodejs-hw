import pinoHttp from 'pino-http';

export const logger = pinoHttp({
  redact: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
  ],
});
