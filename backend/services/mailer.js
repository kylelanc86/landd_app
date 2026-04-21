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

// Validate email configuration
const validateEmailConfig = () => {
  const emailConfig = getEmailConfig();
  const required = ['host', 'port', 'user', 'pass', 'from'];
  const missing = required.filter((key) => !emailConfig[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required email configuration: ${missing.join(', ')}`);
  }
  
  // Debug: Log email configuration (mask password)
  console.log('Email configuration loaded:');
  console.log('  HOST:', emailConfig.host);
  console.log('  PORT:', emailConfig.port);
  console.log('  SECURE:', emailConfig.secure);
  console.log('  USER:', emailConfig.user);
  console.log('  FROM:', `${emailConfig.fromName} <${emailConfig.from}>`);
  console.log('  PASS:', emailConfig.pass ? `${emailConfig.pass.substring(0, 4)}...${emailConfig.pass.substring(emailConfig.pass.length - 4)}` : 'NOT SET');
};

// Create transporter
const createTransporter = () => {
  validateEmailConfig();
  const emailConfig = getEmailConfig();
  
  const config = {
    host: emailConfig.host,
    port: parseInt(emailConfig.port, 10),
    secure: emailConfig.secure === 'true',
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
    // Add additional debugging
    debug: true,
    logger: true
  };
  
  console.log('Creating transporter with config:', {
    ...config,
    auth: { ...config.auth, pass: '***' }
  });
  
  return nodemailer.createTransport(config);
};

async function sendMail({ to, subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error('Missing required email fields: to, subject, and either text or html');
  }

  console.log('Attempting to send email to:', to);
  
  const transporter = createTransporter();
  const emailConfig = getEmailConfig();
  
  try {
    // Test connection first
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    
    const info = await transporter.sendMail({
      from: `${emailConfig.fromName} <${emailConfig.from}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Error code:', error.code);
    console.error('Error response:', error.response);
    throw error;
  }
}

module.exports = { sendMail }; 