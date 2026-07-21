// Optional SMTP mailer. Nodemailer is imported lazily so the server still boots
// (and everything except emailing keeps working) when SMTP is unconfigured or the
// dependency is missing. Configure via backend/.env:
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true|false), SMTP_USER, SMTP_PASS, SMTP_FROM

export function emailConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST) return null;
  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(SMTP_SECURE) === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    from: SMTP_FROM || SMTP_USER || 'no-reply@centrepointhospitality.in',
  };
}

export function isEmailConfigured() {
  return !!emailConfig();
}

export async function sendMail({ to, subject, html }) {
  const cfg = emailConfig();
  if (!cfg) {
    const err = new Error('Server email (SMTP) is not configured. Set SMTP_* in backend/.env.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  let nodemailer;
  try {
    nodemailer = (await import('nodemailer')).default;
  } catch {
    const err = new Error('Email dependency (nodemailer) is not installed. Run `npm install nodemailer` in backend/.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.auth,
  });
  const info = await transporter.sendMail({ from: cfg.from, to, subject, html });
  return { messageId: info.messageId, from: cfg.from };
}
