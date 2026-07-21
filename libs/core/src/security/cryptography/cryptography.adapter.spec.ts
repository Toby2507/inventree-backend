import { faker } from '@app/testing';
import { CryptographyAdapter } from './cryptography.adapter';

// 32 bytes expressed as 64 lowercase hex characters
const VALID_KEY = faker.string.hexadecimal({ length: 64, casing: 'lower', prefix: '' });

describe('CryptographyAdapter', () => {
  let adapter: CryptographyAdapter;
  const config = { cryptographyKey: VALID_KEY };

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new CryptographyAdapter(config);
  });

  describe('sha256 hashing', () => {
    it('should return a 64-character lowercase hex string (SHA-256)', () => {
      expect(adapter.sha256('hello')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic for the same string input', () => {
      expect(adapter.sha256('test')).toBe(adapter.sha256('test'));
    });

    it('should be deterministic for the same object input', () => {
      const obj = { id: 1, role: 'admin' };
      expect(adapter.sha256(obj)).toBe(adapter.sha256(obj));
    });

    it('should produce the same hash regardless of object key insertion order', () => {
      expect(adapter.sha256({ a: 1, b: 2 })).toBe(adapter.sha256({ b: 2, a: 1 }));
    });

    it('should produce different hashes for different string inputs', () => {
      expect(adapter.sha256('foo')).not.toBe(adapter.sha256('bar'));
    });

    it('should produce different hashes for different objects', () => {
      expect(adapter.sha256({ a: 1 })).not.toBe(adapter.sha256({ a: 2 }));
    });

    it('should handle null without throwing', () => {
      expect(() => adapter.sha256(null)).not.toThrow();
    });

    it('should handle numeric input without throwing', () => {
      expect(() => adapter.sha256(42)).not.toThrow();
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

  describe('randomBytes() and randomToken()', () => {
    it('should return a Buffer of the requested size', () => {
      const size = 16;
      const buf = adapter.randomBytes(size);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBe(size);
    });

    it('should return a base64url string of the requested size', () => {
      const size = 32;
      const token = adapter.randomToken(size);
      expect(typeof token).toBe('string');
      // Base64url encoding expands the byte length to ~4/3, so we check the length accordingly
      expect(token.length).toBeGreaterThanOrEqual(Math.ceil((size * 4) / 3));
    });

    it('should default to 32 bytes for randomToken()', () => {
      const token = adapter.randomToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThanOrEqual(Math.ceil((32 * 4) / 3));
    });
  });

  describe('getKey() validation', () => {
    it('should throw when CRYPTOGRAPHY_KEY is absent from config', () => {
      config.cryptographyKey = '';
      expect(() => adapter.encrypt('x')).toThrow('CRYPTOGRAPHY_KEY is not configured');
    });

    it('should throw when CRYPTOGRAPHY_KEY is shorter than 64 hex chars', () => {
      config.cryptographyKey = 'a'.repeat(62);
      expect(() => adapter.encrypt('x')).toThrow(
        'CRYPTOGRAPHY_KEY must be 32 bytes (64 hex characters)',
      );
    });

    it('should throw when CRYPTOGRAPHY_KEY is longer than 64 hex chars', () => {
      config.cryptographyKey = 'a'.repeat(66);
      expect(() => adapter.encrypt('x')).toThrow(
        'CRYPTOGRAPHY_KEY must be 32 bytes (64 hex characters)',
      );
    });

    it('should accept a valid 64-char hex key without throwing', () => {
      config.cryptographyKey = VALID_KEY;
      expect(() => adapter.encrypt('x')).not.toThrow();
    });
  });
});
