import { MAIL_CONFIG, MailConfig, mailConfig } from '@app/config';
import { MailProvider } from '@app/shared-kernel';
import { ConfigModule } from '@nestjs/config';
import { MAIL_PROVIDER } from './ports/mail.port';
import { FakeMailProvider } from './providers/fake-mail.provider';
import { SmtpMailProvider } from './providers/smtp.provider';

export default {
  provide: MAIL_PROVIDER,
  imports: [ConfigModule.forFeature(mailConfig)],
  inject: [MAIL_CONFIG, SmtpMailProvider, FakeMailProvider],
  useFactory: (config: MailConfig, smtp: SmtpMailProvider, fake: FakeMailProvider) => {
    switch (config.provider) {
      case MailProvider.SMTP:
        return smtp;
      case MailProvider.FAKE:
        return fake;
      default:
        throw new Error(`Unsupported mail provider: ${config.provider}`);
    }
  },
};
