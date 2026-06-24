import { ConfigType } from '@nestjs/config';
import { IsDefined, IsString } from 'class-validator';
import { createConfig } from '../utils/factory.config';

class JwtEnvConfig {
  @IsDefined()
  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsDefined()
  @IsString()
  JWT_ACCESS_TTL!: string;

  @IsDefined()
  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsDefined()
  @IsString()
  JWT_REFRESH_TTL!: string;

  @IsDefined()
  @IsString()
  JWT_UTIL_SECRET!: string;

  @IsDefined()
  @IsString()
  JWT_ISSUER!: string;

  @IsDefined()
  @IsString()
  JWT_AUDIENCE!: string;
}

export const jwtConfig = createConfig('jwt', JwtEnvConfig, (cfg) => ({
  accessSecret: cfg.JWT_ACCESS_SECRET,
  accessTtl: cfg.JWT_ACCESS_TTL,
  refreshSecret: cfg.JWT_REFRESH_SECRET,
  refreshTtl: cfg.JWT_REFRESH_TTL,
  utilSecret: cfg.JWT_UTIL_SECRET,
  issuer: cfg.JWT_ISSUER,
  audience: cfg.JWT_AUDIENCE,
}));

export const JWT_CONFIG = jwtConfig.KEY;
export type JwtConfig = ConfigType<typeof jwtConfig>;
