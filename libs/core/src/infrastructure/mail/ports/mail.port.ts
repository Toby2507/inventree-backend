export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface MailProviderPort {
  send(options: MailOptions): Promise<void>;
}
