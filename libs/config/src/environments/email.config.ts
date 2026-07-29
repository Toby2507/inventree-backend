import { EmailProvider } from '@app/shared-kernel';
import { ConfigType } from '@nestjs/config';
import { Transform } from 'class-transformer';
import { IsDefined, IsEnum, IsNumber, IsString, ValidateIf } from 'class-validator';
import { createConfig } from '../utils/factory.config';

class EmailEnvConfig {
  @IsDefined()
  @IsEnum(EmailProvider)
  MAIL_PROVIDER!: EmailProvider;

  @ValidateIf((o) => o.MAIL_PROVIDER === EmailProvider.SMTP)
  @IsDefined()
  @IsString()
  SMTP_HOST!: string;

  @ValidateIf((o) => o.MAIL_PROVIDER === EmailProvider.SMTP)
  @IsDefined()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  SMTP_PORT!: number;

  @ValidateIf((o) => o.MAIL_PROVIDER === EmailProvider.SMTP)
  @IsDefined()
  @IsString()
  SMTP_USER!: string;

  @ValidateIf((o) => o.MAIL_PROVIDER === EmailProvider.SMTP)
  @IsDefined()
  @IsString()
  SMTP_PASSWORD!: string;

  @ValidateIf((o) => o.MAIL_PROVIDER === EmailProvider.SMTP)
  @IsDefined()
  @IsString()
  SMTP_FROM!: string;
}

export const emailConfig = createConfig('email', EmailEnvConfig, (cfg) => ({
  provider: cfg.MAIL_PROVIDER,
  smtp: {
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    user: cfg.SMTP_USER,
    password: cfg.SMTP_PASSWORD,
    from: cfg.SMTP_FROM,
  },
}));

export const EMAIL_CONFIG = emailConfig.KEY;
export type EmailConfig = ConfigType<typeof emailConfig>;
