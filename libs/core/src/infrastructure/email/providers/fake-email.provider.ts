import type { EmailOptions, EmailProvider } from '../ports/email.port';

interface SentEmail {
  sentAt: Date;
  options: EmailOptions;
}

export class FakeEmailProvider implements EmailProvider {
  private sentEmails: SentEmail[] = [];

  get count(): number {
    return this.sentEmails.length;
  }

  get emails(): readonly Readonly<SentEmail>[] {
    return this.sentEmails;
  }

  async send(options: EmailOptions): Promise<void> {
    this.sentEmails.push({ options, sentAt: new Date() });
  }

  clear(): void {
    this.sentEmails.length = 0;
  }

  last(): SentEmail | undefined {
    return this.sentEmails.at(-1);
  }
}
