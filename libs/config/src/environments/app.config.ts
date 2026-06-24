import { Environment } from '@app/common/types';
import { ConfigType } from '@nestjs/config';
import { Transform } from 'class-transformer';
import { IsDefined, IsEnum, IsNumber, IsString } from 'class-validator';
import { createConfig } from '../utils/factory.config';

class AppEnvConfig {
  @IsDefined()
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsDefined()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  PORT!: number;

  @IsDefined()
  @IsString()
  SYSTEM_NAME!: string;

  @IsDefined()
  @IsString()
  API_URL!: string;
}

export const appConfig = createConfig('app', AppEnvConfig, (cfg) => ({
  environment: cfg.NODE_ENV,
  port: cfg.PORT,
  name: cfg.SYSTEM_NAME,
  apiUrl: cfg.API_URL,
}));

export const APP_CONFIG = appConfig.KEY;
export type AppConfig = ConfigType<typeof appConfig>;
