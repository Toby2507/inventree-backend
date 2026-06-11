import { Fn } from '../types';

export const copyMethodMetadata = (from: Fn, to: Fn): void => {
  Reflect.getMetadataKeys(from).forEach((key) => {
    Reflect.defineMetadata(key, Reflect.getMetadata(key, from), to);
  });
};
