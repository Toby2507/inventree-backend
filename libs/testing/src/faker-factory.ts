export function createFaker<T>(generator: () => T) {
  return {
    generate(): T {
      return generator();
    },
    generateWithOverrides(overrides: Partial<T>): T {
      return { ...generator(), ...overrides };
    },
    generateMany(count: number): T[] {
      return Array.from({ length: count }, () => generator());
    },
  };
}
