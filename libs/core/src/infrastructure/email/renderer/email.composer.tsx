import { Injectable } from '@nestjs/common';
import type { ReactElement } from 'react';
import { render, toPlainText } from 'react-email';
import { VerificationEmail, type VerificationEmailProps } from '../templates/verification-email';

export interface RenderedEmail {
  html: string;
  text: string;
}

export interface ComposedEmail extends RenderedEmail {
  subject: string;
}

@Injectable()
export class EmailComposer {
  async composeVerificationEmail(props: VerificationEmailProps): Promise<ComposedEmail> {
    const { html, text } = await this.render(<VerificationEmail {...props} />);
    return {
      html,
      text,
      subject: 'Verify your email address!',
    };
  }

  private async render(template: ReactElement): Promise<RenderedEmail> {
    const html = await render(template);
    const text = toPlainText(html);
    return { html, text };
  }
}
