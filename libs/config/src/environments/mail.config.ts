import { MailProvider } from '@app/shared-kernel';
import { ConfigType } from '@nestjs/config';
import { IsDefined, IsEnum, IsNumber, IsString, ValidateIf } from 'class-validator';
import { createConfig } from '../utils/factory.config';
import { Transform } from 'class-transformer';

class MailEnvConfig {
  @IsDefined()
  @IsEnum(MailProvider)
  MAIL_PROVIDER!: MailProvider;

  @ValidateIf((o) => o.MAIL_PROVIDER === MailProvider.SMTP)
  @IsDefined()
  @IsString()
  SMTP_HOST!: string;

  @ValidateIf((o) => o.MAIL_PROVIDER === MailProvider.SMTP)
  @IsDefined()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  SMTP_PORT!: number;

  @ValidateIf((o) => o.MAIL_PROVIDER === MailProvider.SMTP)
  @IsDefined()
  @IsString()
  SMTP_USER!: string;

  @ValidateIf((o) => o.MAIL_PROVIDER === MailProvider.SMTP)
  @IsDefined()
  @IsString()
  SMTP_PASSWORD!: string;

  @ValidateIf((o) => o.MAIL_PROVIDER === MailProvider.SMTP)
  @IsDefined()
  @IsString()
  SMTP_FROM!: string;
}

export const mailConfig = createConfig('mail', MailEnvConfig, (cfg) => ({
  provider: cfg.MAIL_PROVIDER,
  smtp: {
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    user: cfg.SMTP_USER,
    password: cfg.SMTP_PASSWORD,
    from: cfg.SMTP_FROM,
  },
}));

export const MAIL_CONFIG = mailConfig.KEY;
export type MailConfig = ConfigType<typeof mailConfig>;
