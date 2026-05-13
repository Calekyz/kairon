const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(email, token) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"KAIRON Trading" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your KAIRON Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3B82F6;">Welcome to KAIRON</h1>
          <p>Please verify your email address to start trading with professional signals.</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Verify Email Address
          </a>
          <p>Or copy this link: ${verificationUrl}</p>
          <p>This link expires in 24 hours.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">KAIRON Trading Systems - Professional Trading Signals</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(email, name) {
    const mailOptions = {
      from: `"KAIRON Trading" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to KAIRON - Start Trading',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3B82F6;">Welcome to KAIRON, ${name || 'Trader'}!</h1>
          <p>You're now part of an elite trading community.</p>
          <h2>Next Steps:</h2>
          <ol>
            <li>Choose your subscription plan</li>
            <li>Set up your trading preferences</li>
            <li>Start receiving professional signals</li>
          </ol>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #10B981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Go to Dashboard
          </a>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendSubscriptionConfirmation(email, plan, expiryDate) {
    const mailOptions = {
      from: `"KAIRON Trading" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Subscription Activated - KAIRON',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Subscription Activated!</h1>
          <p>Your ${plan} plan is now active until ${new Date(expiryDate).toLocaleDateString()}.</p>
          <p>Start receiving trading signals immediately.</p>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Access Dashboard
          </a>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}

module.exports = EmailService;
