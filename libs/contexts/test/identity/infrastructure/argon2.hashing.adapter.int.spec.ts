import { Argon2HashingAdapter } from '@app/contexts/identity/infrastructure/security/hashing/argon2.hashing.adapter';

describe('Argon2HashingAdapter (integration)', () => {
  let adapter: Argon2HashingAdapter;

  beforeEach(() => {
    adapter = new Argon2HashingAdapter();
  });

  it('should hash and verify a value correctly', async () => {
    const value = 'password123';
    const hash = await adapter.hash(value);
    const isValid = await adapter.compare(value, hash);
    expect(hash).not.toBe(value);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await adapter.hash('password123');
    const result = await adapter.compare('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('should produce different hashes for the same value', async () => {
    const value = 'password123';
    const hash1 = await adapter.hash(value);
    const hash2 = await adapter.hash(value);
    expect(hash1).not.toBe(hash2);
  });

  it('should fail verification for tampered hash', async () => {
    const value = 'password123';
    const hash = await adapter.hash(value);
    const tamperedHash = hash.slice(0, -1) + Math.random().toString(36).slice(0, 3);
    const result = await adapter.compare(value, tamperedHash);
    expect(result).toBe(false);
  });
});
