import { ConfigType } from '@nestjs/config';
import { IsDefined, IsEnum, IsOptional, IsString } from 'class-validator';
import { createConfig } from '../utils/factory.config';
import { EnvironmentType } from './app.config';

class ObservabilityEnvConfig {
  @IsDefined()
  @IsEnum(EnvironmentType)
  NODE_ENV!: EnvironmentType;

  @IsDefined()
  @IsString()
  OTEL_EXPORTER_OTLP_ENDPOINT!: string;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;
}

export const observabilityConfig = createConfig('observability', ObservabilityEnvConfig, (cfg) => ({
  logLevel: cfg.LOG_LEVEL ?? 'info',
  otelExporterEndpoint: cfg.OTEL_EXPORTER_OTLP_ENDPOINT,
  prettyPrint: cfg.NODE_ENV !== EnvironmentType.PRODUCTION,
}));

export const OBSERVABILITY_CONFIG = observabilityConfig.KEY;
export type ObservabilityConfig = ConfigType<typeof observabilityConfig>;
