import { ReactElement } from 'react';
import { WelcomeEmailProps } from '../templates/welcome-email';

export const MAIL_COMPOSER = Symbol('MAIL_COMPOSER');

export interface RenderedMail {
  html: string;
  text: string;
}

export interface ComposedMail extends RenderedMail {
  subject: string;
}

export interface MailTemplateRenderPort {
  render(template: ReactElement): Promise<RenderedMail>;
}

export interface MailComposerPort {
  composeWelcomeEmail(props: WelcomeEmailProps): Promise<ComposedMail>;
}
