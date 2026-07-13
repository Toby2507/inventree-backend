import { MailOptions, MailProviderPort } from '../ports/mail.port';

interface SentMail {
  sentAt: Date;
  options: MailOptions;
}

export class FakeMailProvider implements MailProviderPort {
  private sentMail: SentMail[] = [];

  get count(): number {
    return this.sentMail.length;
  }

  get mails(): readonly Readonly<SentMail>[] {
    return this.sentMail;
  }

  async send(options: MailOptions): Promise<void> {
    this.sentMail.push({ options, sentAt: new Date() });
  }

  clear(): void {
    this.sentMail.length = 0;
  }

  last(): SentMail | undefined {
    return this.sentMail.at(-1);
  }
}
