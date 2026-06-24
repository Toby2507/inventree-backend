import { ConfigType } from '@nestjs/config';
import { Transform } from 'class-transformer';
import { IsDefined, IsNumber, IsString } from 'class-validator';
import { createConfig } from '../utils/factory.config';

class DatabaseEnvConfig {
  @IsDefined()
  @IsString()
  DB_HOST!: string;

  @IsDefined()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  DB_PORT!: number;

  @IsDefined()
  @IsString()
  DB_USER!: string;

  @IsDefined()
  @IsString()
  DB_NAME!: string;

  @IsDefined()
  @IsString()
  DB_PASSWORD!: string;
}

export const databaseConfig = createConfig('database', DatabaseEnvConfig, (cfg) => ({
  host: cfg.DB_HOST,
  port: cfg.DB_PORT,
  user: cfg.DB_USER,
  name: cfg.DB_NAME,
  password: cfg.DB_PASSWORD,
}));

export const DATABASE_CONFIG = databaseConfig.KEY;
export type DatabaseConfig = ConfigType<typeof databaseConfig>;
