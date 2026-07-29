import { LogLevel } from '@app/shared-kernel';
import { ConfigType } from '@nestjs/config';
import { IsEnum, IsOptional } from 'class-validator';
import { createConfig } from '../utils/factory.config';

class ObservabilityEnvConfig {
  @IsOptional()
  @IsEnum(LogLevel)
  LOG_LEVEL?: LogLevel;
}

export const observabilityConfig = createConfig('observability', ObservabilityEnvConfig, (cfg) => ({
  logLevel: cfg.LOG_LEVEL ?? LogLevel.INFO,
}));

export const OBSERVABILITY_CONFIG = observabilityConfig.KEY;
export type ObservabilityConfig = ConfigType<typeof observabilityConfig>;
