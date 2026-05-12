export interface UUIDGeneratorPort {
  generateV4(): string;
  generateV7(): string;
}

export const UUID_GENERATOR_PORT = Symbol('UUID_GENERATOR_PORT');
