import { Environment, LogLevel } from '@app/common/types';
import { ConfigType } from '@nestjs/config';
import { IsDefined, IsEnum, IsOptional } from 'class-validator';
import { createConfig } from '../utils/factory.config';

class ObservabilityEnvConfig {
  @IsDefined()
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsOptional()
  @IsEnum(LogLevel)
  LOG_LEVEL?: LogLevel;
}

export const observabilityConfig = createConfig('observability', ObservabilityEnvConfig, (cfg) => ({
  logLevel: cfg.LOG_LEVEL ?? LogLevel.INFO,
  prettyPrint: cfg.NODE_ENV !== Environment.PRODUCTION,
}));

export const OBSERVABILITY_CONFIG = observabilityConfig.KEY;
export type ObservabilityConfig = ConfigType<typeof observabilityConfig>;
