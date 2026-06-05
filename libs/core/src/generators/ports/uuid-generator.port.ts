export interface IDGeneratorPort {
  generateUUIDV4(): string;
  generateUUIDV7(): string;
}

export const ID_GENERATOR_PORT = Symbol('ID_GENERATOR_PORT');
