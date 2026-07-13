import { Module } from '@nestjs/common';
import Mailer from './mail.provider';
import { MAIL_COMPOSER } from './ports/renderer.port';
import { FakeMailProvider } from './providers/fake-mail.provider';
import { SmtpMailProvider } from './providers/smtp.provider';
import { MailComposer } from './renderer/mail.composer';

@Module({
  providers: [
    Mailer,
    FakeMailProvider,
    SmtpMailProvider,
    { provide: MAIL_COMPOSER, useClass: MailComposer },
  ],
  exports: [MAIL_COMPOSER],
})
export class MailModule {}
