import { ClassConstructor } from '@app/common/types';
import { ConfigObject, registerAs } from '@nestjs/config';
import { validate } from './validation.config';

export function createConfig<T, P extends ConfigObject>(
  namespace: string,
  dto: ClassConstructor<T>,
  mapper: (validated: T) => P,
) {
  return registerAs<P>(namespace, () => {
    const validated = validate<T>(process.env, dto);
    return mapper(validated);
  });
}
