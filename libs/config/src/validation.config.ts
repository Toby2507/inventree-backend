import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { config as dotenvConfig } from 'dotenv';
import { Environment } from './schema.config';

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(Environment, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    stopAtFirstError: false,
  });

  if (errors.length > 0) {
    Logger.error(parseError(errors), 'Config validation error');
    process.exit(1);
  }
  return validatedConfig;
}

function parseError(errors: ValidationError[]) {
  const map: Record<string, string[]> = {};
  for (const e of errors) {
    Object.values(e.constraints!).forEach((e) => {
      const [key, ...others] = e.split(' ');
      const message = others.join(' ');
      if (map[key]) map[key].push(message);
      else map[key] = [message];
    });
  }
  return map;
}

dotenvConfig();
export const configConstants = validate(process.env);
