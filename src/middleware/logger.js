import pinoHttp from 'pino-http';

export const logger = pinoHttp({
  serializers: {
    req: (req) => ({
      ...req,
      // JWT із посилання скидання пароля не має потрапляти в access log.
      url: req.url?.replace(/([?&]token=)[^&]*/gi, '$1[Redacted]'),
    }),
  },
  redact: [
    'req.headers.cookie',
    'req.headers.authorization',
    'req.headers.referer',
    'req.query.token',
    'res.headers["set-cookie"]',
  ],
});
