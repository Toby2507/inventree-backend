import { MAIL_CONFIG, MailConfig } from '@app/config';
import { Inject } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { MailOptions, MailProviderPort } from '../ports/mail.port';

export class SmtpMailProvider implements MailProviderPort {
  private transporter: Transporter;

  constructor(@Inject(MAIL_CONFIG) private readonly config: MailConfig) {
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

  async send(options: MailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.smtp.from,
      to: options.to,
      html: options.html,
      text: options.text,
      subject: options.subject,
    });
  }
}
