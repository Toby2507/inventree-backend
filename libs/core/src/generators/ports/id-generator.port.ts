export interface IDGeneratorPort {
  generateUUIDV4(): string;
  generateUUIDV7(): string;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');
