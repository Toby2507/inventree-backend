import { ConfigType } from '@nestjs/config';
import { IsDefined, IsString } from 'class-validator';
import { createConfig } from '../utils/factory.config';

class SecurityEnvConfig {
  @IsDefined()
  @IsString()
  CRYPTOGRAPHY_KEY!: string;
}

export const securityConfig = createConfig('security', SecurityEnvConfig, (cfg) => ({
  cryptographyKey: cfg.CRYPTOGRAPHY_KEY,
}));

export const SECURITY_CONFIG = securityConfig.KEY;
export type SecurityConfig = ConfigType<typeof securityConfig>;
