import { Injectable } from '@nestjs/common';
import { ReactElement } from 'react';
import { render, toPlainText } from 'react-email';
import { ComposedMail, MailComposerPort, RenderedMail } from '../ports/renderer.port';
import { WelcomeEmail, WelcomeEmailProps } from '../templates/welcome-email';

@Injectable()
export class MailComposer implements MailComposerPort {
  async composeWelcomeEmail(props: WelcomeEmailProps): Promise<ComposedMail> {
    const { html, text } = await this.render(<WelcomeEmail {...props} />);
    return {
      html,
      text,
      subject: 'Welcome to our platform!',
    };
  }

  private async render(template: ReactElement): Promise<RenderedMail> {
    const html = await render(template);
    const text = toPlainText(html);
    return { html, text };
  }
}
