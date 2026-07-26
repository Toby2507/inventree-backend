import { appConfig, emailConfig } from '@app/config';
import { ActionTokenModule } from '@app/core/security/action-token';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { EmailDispatchService } from './email.dispatcher';
import EmailProvider from './email.provider';
import { EmailRegistry } from './email.registry';
import { VerificationEmailHandler } from './handlers/verification-mail.handler';
import { EMAIL_DISPATCHER } from './ports/dispatcher.port';
import { FakeEmailProvider } from './providers/fake-email.provider';
import { SmtpEmailProvider } from './providers/smtp.provider';
import { EmailComposer } from './renderer/email.composer';

@Module({
  imports: [
    ConfigModule.forFeature(appConfig),
    ConfigModule.forFeature(emailConfig),
    ActionTokenModule,
    DiscoveryModule,
  ],
  providers: [
    EmailComposer,
    EmailProvider,
    EmailRegistry,
    { provide: EMAIL_DISPATCHER, useClass: EmailDispatchService },
    // Vendor Provider
    FakeEmailProvider,
    SmtpEmailProvider,
    // Handlers
    VerificationEmailHandler,
  ],
  exports: [EMAIL_DISPATCHER],
})
export class EmailModule {}
