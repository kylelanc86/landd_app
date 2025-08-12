const nodemailer = require('nodemailer');

// Validate email configuration
const validateEmailConfig = () => {
  const required = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required email configuration: ${missing.join(', ')}`);
  }
  
  // Debug: Log email configuration (mask password)
  console.log('Email configuration loaded:');
  console.log('  HOST:', process.env.EMAIL_HOST);
  console.log('  PORT:', process.env.EMAIL_PORT);
  console.log('  SECURE:', process.env.EMAIL_SECURE);
  console.log('  USER:', process.env.EMAIL_USER);
  console.log('  PASS:', process.env.EMAIL_PASS ? `${process.env.EMAIL_PASS.substring(0, 4)}...${process.env.EMAIL_PASS.substring(process.env.EMAIL_PASS.length - 4)}` : 'NOT SET');
};

// Create transporter
const createTransporter = () => {
  validateEmailConfig();
  
  const config = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
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
  
  try {
    // Test connection first
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    
    const info = await transporter.sendMail({
      from: "L&D APP ADMIN", // Custom name
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