import { EMAIL_CONFIG, type EmailConfig } from '@app/config';
import { Inject } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { EmailOptions, EmailProvider } from '../ports/email.port';

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor(@Inject(EMAIL_CONFIG) private readonly config: EmailConfig) {
    this.transporter = createTransport({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: false,
      auth: {
        user: this.config.smtp.user,
        pass: this.config.smtp.password,
      },
    });
  }

  async send(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.smtp.from,
      to: options.to,
      html: options.html,
      text: options.text,
      subject: options.subject,
    });
  }
}
