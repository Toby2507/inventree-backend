import { Transform } from 'class-transformer';
import { IsDefined, IsEnum, IsNumber, IsString } from 'class-validator';

enum EnvironmentType {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export class Environment {
  // Database
  @IsDefined()
  @IsString()
  POSTGRES_PASSWORD!: string;

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

  @IsDefined()
  @IsString()
  ANALYTICS_DB_HOST!: string;

  @IsDefined()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  ANALYTICS_DB_PORT!: number;

  @IsDefined()
  @IsString()
  ANALYTICS_DB_USER!: string;

  @IsDefined()
  @IsString()
  ANALYTICS_DB_NAME!: string;

  @IsDefined()
  @IsString()
  ANALYTICS_DB_PASSWORD!: string;

  // Cache
  @IsDefined()
  @IsString()
  REDIS_PASSWORD!: string;

  @IsDefined()
  @IsString()
  REDIS_URL!: string;

  // API
  @IsDefined()
  @IsEnum(EnvironmentType)
  NODE_ENV!: EnvironmentType;

  @IsDefined()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  PORT!: number;

  // APP Info
  @IsDefined()
  @IsString()
  SYSTEM_NAME!: string;

  @IsDefined()
  @IsString()
  API_URL!: string;

  // JWT
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
