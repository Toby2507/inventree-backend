import { Transform } from 'class-transformer';
import { IsDefined, IsEnum, IsNumber, IsString } from 'class-validator';
import { createConfig } from '../utils/factory.config';
import { ConfigType } from '@nestjs/config';

export enum EnvironmentType {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

class AppEnvConfig {
  @IsDefined()
  @IsEnum(EnvironmentType)
  NODE_ENV!: EnvironmentType;

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
