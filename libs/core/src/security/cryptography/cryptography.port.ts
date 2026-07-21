export interface CryptographyPort {
  sha256(data: unknown): string;
  encrypt(data: string): string;
  decrypt(data: string): string;
  randomBytes(size: number): Buffer;
  randomToken(size?: number): string;
}

export const CRYPTOGRAPHY = Symbol('CRYPTOGRAPHY');
