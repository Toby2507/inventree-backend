import { ClassConstructor } from '@app/common/types';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';

export function validate<T>(config: Record<string, unknown>, dto: ClassConstructor<T>): T {
  const validatedConfig = plainToInstance(dto, config);
  const errors = validateSync(validatedConfig as object, {
    skipMissingProperties: false,
    stopAtFirstError: false,
  });
  if (errors.length > 0)
    throw new Error(`Config validation error: ${JSON.stringify(parseError(errors), null, 2)}`);
  return validatedConfig;
}

function parseError(errors: ValidationError[]) {
  const map: Record<string, string[]> = {};
  for (const e of errors) {
    const messages = Object.values(e.constraints ?? {});
    if (messages.length === 0) continue;
    map[e.property] = map[e.property] ? [...map[e.property], ...messages] : messages;
  }
  return map;
}
