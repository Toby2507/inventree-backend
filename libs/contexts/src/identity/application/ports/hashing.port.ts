export interface HashingPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export const HASHING = Symbol('HASHING');
