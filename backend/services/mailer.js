const nodemailer = require('nodemailer');

const getEmailConfig = () => ({
  host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
  port: process.env.EMAIL_PORT || process.env.SMTP_PORT,
  secure: process.env.EMAIL_SECURE ?? process.env.SMTP_SECURE,
  user: process.env.EMAIL_USER || process.env.SMTP_USER,
  pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
  from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
  fromName: process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'L&D APP ADMIN'
});

let transporter = null;

const validateEmailConfig = () => {
  const emailConfig = getEmailConfig();
  const required = ['host', 'port', 'user', 'pass', 'from'];
  const missing = required.filter((key) => !emailConfig[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required email configuration: ${missing.join(', ')}`);
  }

  return emailConfig;
};

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const emailConfig = validateEmailConfig();
  const debug = process.env.EMAIL_DEBUG === 'true';

  transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    host: emailConfig.host,
    port: parseInt(emailConfig.port, 10),
    secure: emailConfig.secure === 'true',
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
    debug,
    logger: debug,
  });

  return transporter;
};

async function warmMailer() {
  try {
    await getTransporter().verify();
    console.log('SMTP connection ready');
  } catch (error) {
    transporter = null;
    console.error('SMTP warmup failed:', error.message);
  }
}

async function sendMail({ to, subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error('Missing required email fields: to, subject, and either text or html');
  }

  const emailConfig = validateEmailConfig();
  console.log('Sending email to:', to);

  try {
    const info = await getTransporter().sendMail({
      from: `${emailConfig.fromName} <${emailConfig.from}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    if (['ECONNECTION', 'ETIMEDOUT', 'EAUTH', 'ESOCKET', 'ECONNECTIONRESET'].includes(error.code)) {
      transporter = null;
    }
    console.error('Error sending email:', error.message);
    throw error;
  }
}

module.exports = { sendMail, warmMailer };
