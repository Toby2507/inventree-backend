import { EntityConstructor } from '@app/common';

export function createFaker<T>(generator: () => T) {
  return {
    generate(overrides: Partial<T> = {}): T {
      return { ...generator(), ...overrides };
    },
    generateMany(count: number, overrides: Partial<T> | ((index: number) => Partial<T>) = {}): T[] {
      return Array.from({ length: count }, (_, i) => {
        const resolvedOverrides = typeof overrides === 'function' ? overrides(i) : overrides;
        return { ...generator(), ...resolvedOverrides };
      });
    },
  };
}

export function createEntityFaker<T, C, S>(
  EntityClass: EntityConstructor<T, C, S>,
  defaultCreateProps: () => C,
  defaultSnapshot: () => S,
) {
  return {
    // Create a new entity
    generate(overrides: Partial<C> = {}): T {
      return EntityClass.create({ ...defaultCreateProps(), ...overrides });
    },
    generateMany(count: number, overrides: Partial<C> | ((index: number) => Partial<C>) = {}): T[] {
      return Array.from({ length: count }, (_, i) => {
        const resolvedOverrides = typeof overrides === 'function' ? overrides(i) : overrides;
        return EntityClass.create({ ...defaultCreateProps(), ...resolvedOverrides });
      });
    },
    // Create an entity from a snapshot
    generateFromSnapshot(overrides: Partial<S> = {}): T {
      return EntityClass.reconstitute({ ...defaultSnapshot(), ...overrides });
    },
    generateManyFromSnapshot(
      count: number,
      overrides: Partial<S> | ((index: number) => Partial<S>) = {},
    ): T[] {
      return Array.from({ length: count }, (_, i) => {
        const resolvedOverrides = typeof overrides === 'function' ? overrides(i) : overrides;
        return EntityClass.reconstitute({ ...defaultSnapshot(), ...resolvedOverrides });
      });
    },
  };
}
