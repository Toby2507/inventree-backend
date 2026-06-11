import { faker } from '@app/testing';
import { makeConfigMock } from '@app/testing/system';
import { ObfuscationAdapter } from './obfuscation.adapter';

// 32 bytes expressed as 64 lowercase hex characters
const VALID_KEY = faker.string.hexadecimal({ length: 64, casing: 'lower', prefix: '' });

describe('ObfuscationAdapter', () => {
  let adapter: ObfuscationAdapter;

  const configService = makeConfigMock();

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ObfuscationAdapter(configService);
    configService.get.mockReturnValue(VALID_KEY);
  });

  describe('hash()', () => {
    it('should return a 64-character lowercase hex string (SHA-256)', () => {
      expect(adapter.hash('hello')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic for the same string input', () => {
      expect(adapter.hash('test')).toBe(adapter.hash('test'));
    });

    it('should be deterministic for the same object input', () => {
      const obj = { id: 1, role: 'admin' };
      expect(adapter.hash(obj)).toBe(adapter.hash(obj));
    });

    it('should produce the same hash regardless of object key insertion order', () => {
      expect(adapter.hash({ a: 1, b: 2 })).toBe(adapter.hash({ b: 2, a: 1 }));
    });

    it('should produce different hashes for different string inputs', () => {
      expect(adapter.hash('foo')).not.toBe(adapter.hash('bar'));
    });

    it('should produce different hashes for different objects', () => {
      expect(adapter.hash({ a: 1 })).not.toBe(adapter.hash({ a: 2 }));
    });

    it('should handle null without throwing', () => {
      expect(() => adapter.hash(null)).not.toThrow();
    });

    it('should handle numeric input without throwing', () => {
      expect(() => adapter.hash(42)).not.toThrow();
    });
  });

  describe('encrypt()', () => {
    it('should return a string with exactly 3 colon-delimited parts', () => {
      expect(adapter.encrypt('secret').split(':')).toHaveLength(3);
    });

    it('should encode the IV as 24 hex characters (12 bytes)', () => {
      const [ivHex] = adapter.encrypt('secret').split(':');
      expect(ivHex).toMatch(/^[0-9a-f]{24}$/);
    });

    it('should encode the auth tag as 32 hex characters (16 bytes)', () => {
      const [, authTagHex] = adapter.encrypt('secret').split(':');
      expect(authTagHex).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should produce a different ciphertext on every call (random IV)', () => {
      const a = adapter.encrypt('same-plaintext');
      const b = adapter.encrypt('same-plaintext');
      expect(a).not.toBe(b);
    });
  });

  describe('decrypt()', () => {
    it('should round-trip a plain ASCII string', () => {
      const plain = 'hello world';
      expect(adapter.decrypt(adapter.encrypt(plain))).toBe(plain);
    });

    it('should round-trip a multi-byte / emoji string', () => {
      const plain = '🔑 s3cr3t 🔐';
      expect(adapter.decrypt(adapter.encrypt(plain))).toBe(plain);
    });

    it('should round-trip a long string', () => {
      const plain = 'x'.repeat(10_000);
      expect(adapter.decrypt(adapter.encrypt(plain))).toBe(plain);
    });

    it('should round-trip an empty string', () => {
      expect(adapter.decrypt(adapter.encrypt(''))).toBe('');
    });

    it('should throw on a single-part ciphertext', () => {
      expect(() => adapter.decrypt('onlyone')).toThrow('Invalid ciphertext format');
    });

    it('should throw on a two-part ciphertext', () => {
      expect(() => adapter.decrypt('a:b')).toThrow('Invalid ciphertext format');
    });

    it('should throw on a four-part ciphertext', () => {
      expect(() => adapter.decrypt('a:b:c:d')).toThrow('Invalid ciphertext format');
    });

    it('should throw when the GCM auth tag is tampered with', () => {
      const [ivHex, , encHex] = adapter.encrypt('sensitive-data').split(':');
      const zeroed = '00'.repeat(16); // replace auth tag with zeros
      expect(() => adapter.decrypt(`${ivHex}:${zeroed}:${encHex}`)).toThrow();
    });

    it('should throw when the ciphertext body is tampered with', () => {
      const [ivHex, tagHex] = adapter.encrypt('sensitive-data').split(':');
      const garbage = 'ff'.repeat(8);
      expect(() => adapter.decrypt(`${ivHex}:${tagHex}:${garbage}`)).toThrow();
    });
  });

  describe('getKey() validation', () => {
    it('should throw when OBFUSCATION_KEY is absent from config', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      expect(() => adapter.encrypt('x')).toThrow('OBFUSCATION_KEY is not configured');
    });

    it('should throw when OBFUSCATION_KEY is shorter than 64 hex chars', () => {
      (configService.get as jest.Mock).mockReturnValue('a'.repeat(62));
      expect(() => adapter.encrypt('x')).toThrow(
        'OBFUSCATION_KEY must be 32 bytes (64 hex characters)',
      );
    });

    it('should throw when OBFUSCATION_KEY is longer than 64 hex chars', () => {
      (configService.get as jest.Mock).mockReturnValue('a'.repeat(66));
      expect(() => adapter.encrypt('x')).toThrow(
        'OBFUSCATION_KEY must be 32 bytes (64 hex characters)',
      );
    });

    it('should accept a valid 64-char hex key without throwing', () => {
      (configService.get as jest.Mock).mockReturnValue(VALID_KEY);
      expect(() => adapter.encrypt('x')).not.toThrow();
    });

    it('should re-read the key on every operation (no stale cache)', () => {
      adapter.encrypt('one');
      adapter.encrypt('two');
      expect(configService.get).toHaveBeenCalledTimes(2);
    });
  });
});
