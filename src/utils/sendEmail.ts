import fs from 'fs';
import path from 'path';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

type EmailTemplate = 'welcome' | 'passwordReset' | 'accountCreated' | 'resultPublished';

type SendEmailInput = {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, string>;
};

const templatesDir = path.join(__dirname, '..', 'templates');

const templateCache: Record<EmailTemplate, string> = {
  welcome: fs.readFileSync(path.join(templatesDir, 'welcome.html'), 'utf8'),
  passwordReset: fs.readFileSync(path.join(templatesDir, 'passwordReset.html'), 'utf8'),
  accountCreated: fs.readFileSync(path.join(templatesDir, 'accountCreated.html'), 'utf8'),
  resultPublished: fs.readFileSync(path.join(templatesDir, 'resultPublished.html'), 'utf8'),
};

const SMTP_VERIFY_TIMEOUT_MS = 8_000;

let transporter: Transporter | null = null;

const interpolate = (template: string, data: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => data[key] ?? '');

const verifyWithTimeout = async (mailer: Transporter): Promise<void> => {
  await Promise.race([
    mailer.verify(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('SMTP verify timed out')), SMTP_VERIFY_TIMEOUT_MS);
    }),
  ]);
};

const createSmtpTransport = (): Transporter =>
  nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth:
      config.SMTP_USER.length > 0 && config.SMTP_PASS.length > 0
        ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
        : undefined,
  });

export const initMailer = async (): Promise<'ok' | 'skipped' | 'failed'> => {
  try {
    if (config.SMTP_HOST.length > 0) {
      transporter = createSmtpTransport();
      await verifyWithTimeout(transporter);
      return 'ok';
    }

    if (config.NODE_ENV !== 'development') {
      return 'skipped';
    }

    const account = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
    await verifyWithTimeout(transporter);
    return 'ok';
  } catch (error) {
    console.error('> Nodemailer setup failed', error);
    transporter = null;
    return 'failed';
  }
};

export const sendEmail = async ({ to, subject, template, data }: SendEmailInput): Promise<void> => {
  if (transporter === null) {
    console.error(`[email] SMTP is not ready. Skipped sending "${subject}" to ${to}`);
    if (config.NODE_ENV === 'development') {
      console.info('[email] template data', data);
    }
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: config.SMTP_FROM,
      to,
      subject,
      html: interpolate(templateCache[template], data),
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (typeof previewUrl === 'string') {
      console.log(`> Email preview: ${previewUrl}`);
    }
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}`, error);
  }
};
