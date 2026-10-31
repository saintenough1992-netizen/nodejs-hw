import nodemailer from 'nodemailer';

export const sendEmail = async (options) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } =
    process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    throw new Error('SMTP configuration is missing');
  }

  const port = Number(SMTP_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return transporter.sendMail({ ...options, from: SMTP_FROM });
};
