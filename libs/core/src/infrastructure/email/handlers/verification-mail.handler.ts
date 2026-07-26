import { APP_CONFIG, type AppConfig } from '@app/config';
import {
  ACTION_TOKEN_PURPOSES,
  ISSUE_TOKEN,
  type IssueActionToken,
} from '@app/core/security/action-token';
import { DATABASE_CONTEXT, type DatabaseContext } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EMAIL_JOBS, type EmailJobHandler } from '../email.interfaces';
import { EmailHandler } from '../email.registry';
import { EMAIL_PROVIDER, type EmailProvider } from '../ports/email.port';
import { EmailComposer } from '../renderer/email.composer';

export interface VerificationEmailJob {
  firstName: string;
  email: string;
  userId: string;
}

@EmailHandler(EMAIL_JOBS.SEND_VERIFICATION_EMAIL)
@Injectable()
export class VerificationEmailHandler implements EmailJobHandler<VerificationEmailJob> {
  readonly job = EMAIL_JOBS.SEND_VERIFICATION_EMAIL;

  constructor(
    private readonly composer: EmailComposer,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE_CONTEXT) private readonly db: DatabaseContext,
    @Inject(ISSUE_TOKEN) private readonly issueToken: IssueActionToken,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  async handle(job: Job<VerificationEmailJob>): Promise<void> {
    const { token } = await this.db.platformCommand((ctx) =>
      this.issueToken.execute(ctx.operational, {
        userId: job.data.userId,
        purpose: ACTION_TOKEN_PURPOSES.EMAIL_VERIFICATION,
      }),
    );
    const mail = await this.composer.composeVerificationEmail({
      firstName: job.data.firstName,
      verificationUrl: `${this.config.appUrl}/auth/verify-email?token=${token}`,
    });
    await this.provider.send({
      to: job.data.email,
      ...mail,
    });
  }
}
