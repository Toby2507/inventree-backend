export interface ObfuscationPort {
  hash(data: unknown): string;
  encrypt(data: string): string;
  decrypt(data: string): string;
}

export const OBFUSCATION = Symbol('OBFUSCATION');
