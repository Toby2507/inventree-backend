import { ConfigType } from '@nestjs/config';
import { Transform } from 'class-transformer';
import { IsDefined, IsNumber, IsString } from 'class-validator';
import { createConfig } from '../utils/factory.config';

class CacheEnvConfig {
  @IsDefined()
  @IsString()
  REDIS_PASSWORD!: string;

  @IsDefined()
  @IsString()
  REDIS_HOST!: string;

  @IsDefined()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  REDIS_PORT!: number;

  @IsDefined()
  @IsString()
  REDIS_URL!: string;
}

export const cacheConfig = createConfig('cache', CacheEnvConfig, (cfg) => ({
  password: cfg.REDIS_PASSWORD,
  host: cfg.REDIS_HOST,
  port: cfg.REDIS_PORT,
  url: cfg.REDIS_URL,
}));

export const CACHE_CONFIG = cacheConfig.KEY;
export type CacheConfig = ConfigType<typeof cacheConfig>;
