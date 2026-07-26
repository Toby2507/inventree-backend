import { EMAIL_CONFIG, type EmailConfig } from '@app/config';
import { EmailProvider } from '@app/shared-kernel';
import { EMAIL_PROVIDER } from './ports/email.port';
import { FakeEmailProvider } from './providers/fake-email.provider';
import { SmtpEmailProvider } from './providers/smtp.provider';

export default {
  provide: EMAIL_PROVIDER,
  inject: [EMAIL_CONFIG, SmtpEmailProvider, FakeEmailProvider],
  useFactory: (config: EmailConfig, smtp: SmtpEmailProvider, fake: FakeEmailProvider) => {
    switch (config.provider) {
      case EmailProvider.SMTP:
        return smtp;
      case EmailProvider.FAKE:
        return fake;
      default:
        throw new Error(`Unsupported mail provider: ${config.provider}`);
    }
  },
};
