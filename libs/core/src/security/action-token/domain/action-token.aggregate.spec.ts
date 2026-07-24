import { Instant } from '@app/shared-kernel';
import { faker } from '@app/testing';
import { feActionToken, fsActionToken } from '@app/testing/core/security';
import { ActionTokenID } from './action-token-id.vo';
import { ActionToken } from './action-token.aggregate';
import {
  TokenAlreadyConsumedException,
  TokenExpiredException,
  TokenExpiryBeforeCreationTimeException,
  TokenRevokedException,
} from './action-token.exceptions';
import { ACTION_TOKEN_REVOKE_REASON } from './action-token.types';

const at = (ms: number) => Instant.fromEpochMs(ms);
const BASE_TIME = 1_700_000_000_000;

describe('ActionToken Aggregate Root', () => {
  // ==== FACTORY ==============
  describe('create()', () => {
    const token = feActionToken.generate();

    it('should create an action token with the correct properties', () => {
      expect(token.id).toBeInstanceOf(ActionTokenID);
      expect(token.userId).toBeDefined();
      expect(token.purpose).toBeDefined();
      expect(token.tokenHash).toBeDefined();
      expect(token.expiresAt).toBeInstanceOf(Instant);
    });

    it('should create an action token with the correct default properties', () => {
      expect(token.version).toBe(0);
      expect(token.isConsumed()).toBe(false);
      expect(token.isRevoked()).toBe(false);
    });

    it('should throw if expiresAt is before createdAt', () => {
      const snapshot = fsActionToken.generate({
        createdAt: at(BASE_TIME + 1_000),
        expiresAt: at(BASE_TIME),
      });
      expect(() => ActionToken.reconstitute(snapshot)).toThrow(
        TokenExpiryBeforeCreationTimeException,
      );
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute an action token from a snapshot', () => {
      const snapshot = fsActionToken.generate({ version: 3 });
      const token = ActionToken.reconstitute(snapshot);
      expect(token.id.value).toBe(snapshot.id);
      expect(token.version).toBe(3);
    });

    it('should round-trip through toSnapshot() without data loss', () => {
      const snapshot = fsActionToken.generate();
      const token = ActionToken.reconstitute(snapshot);
      const roundTripped = token.toSnapshot();
      expect(roundTripped).toEqual(snapshot);
    });

    it('should preserve the consumed and revoked state when reconstituting', () => {
      const snapshot = fsActionToken.generate({
        consumedAt: at(BASE_TIME + 1_000),
        revokedAt: at(BASE_TIME + 5_000),
        revokedReason: ACTION_TOKEN_REVOKE_REASON.MANUAL,
      });
      const token = ActionToken.reconstitute(snapshot);
      expect(token.isConsumed()).toBe(true);
      expect(token.isRevoked()).toBe(true);
    });
  });

  // ==== COMMANDS ==============
  describe('consume()', () => {
    const NOW = at(new Date().getTime());

    it('should mark the token as consumed and bump the version', () => {
      const token = feActionToken.generate();
      token.consume(NOW);
      expect(token.isConsumed()).toBe(true);
      expect(token.version).toBe(1);
      expect(token.toSnapshot().consumedAt).toEqual(NOW);
    });

    describe('guards', () => {
      it('should throw if token is already consumed', () => {
        const token = feActionToken.generate();
        token.consume(NOW);
        expect(() => token.consume(NOW)).toThrow(TokenAlreadyConsumedException);
        expect(token.version).toBe(1);
      });

      it('should throw if token is already revoked', () => {
        const token = feActionToken.generate();
        token.revoke(ACTION_TOKEN_REVOKE_REASON.MANUAL, NOW);
        expect(() => token.consume(NOW)).toThrow(TokenRevokedException);
        expect(token.version).toBe(1);
      });

      it('should throw if token is expired', () => {
        const token = feActionToken.generate({
          createdAt: at(BASE_TIME - 1_000),
          expiresAt: at(BASE_TIME),
        });
        const expiredTime = at(BASE_TIME + 1_000);
        expect(() => token.consume(expiredTime)).toThrow(TokenExpiredException);
        expect(token.version).toBe(0);
      });
    });

    it('should not mutate state when an exception is thrown', () => {
      const token = feActionToken.generate();
      token.consume(NOW);
      const before = token.toSnapshot();
      expect(() => token.consume(NOW)).toThrow();
      expect(token.toSnapshot()).toEqual(before);
    });
  });

  describe('revoke()', () => {
    const NOW = at(new Date().getTime());

    it('should mark the token as revoked and bump the version', () => {
      const token = feActionToken.generate();
      token.revoke(ACTION_TOKEN_REVOKE_REASON.MANUAL, NOW);
      expect(token.isRevoked()).toBe(true);
      expect(token.version).toBe(1);
      expect(token.toSnapshot().revokedAt).toEqual(NOW);
      expect(token.toSnapshot().revokedReason).toEqual(ACTION_TOKEN_REVOKE_REASON.MANUAL);
    });

    it('should throw if token is already consumed', () => {
      const token = feActionToken.generate();
      token.consume(NOW);
      expect(() => token.revoke(ACTION_TOKEN_REVOKE_REASON.MANUAL, NOW)).toThrow(
        TokenAlreadyConsumedException,
      );
      expect(token.version).toBe(1);
    });

    it('should be no-op if token is already revoked', () => {
      const token = feActionToken.generate();
      token.revoke(ACTION_TOKEN_REVOKE_REASON.MANUAL, NOW);
      const before = token.toSnapshot();
      expect(() => token.revoke(ACTION_TOKEN_REVOKE_REASON.MANUAL, NOW)).not.toThrow();
      expect(token.toSnapshot()).toEqual(before);
    });
  });

  describe('predicates', () => {
    it('should return true for isConsumed() if token is consumed', () => {
      const token = feActionToken.generate();
      token.consume(at(BASE_TIME));
      expect(token.isConsumed()).toBe(true);
    });

    it('should return true for isRevoked() if token is revoked', () => {
      const token = feActionToken.generate();
      token.revoke(ACTION_TOKEN_REVOKE_REASON.MANUAL, at(BASE_TIME));
      expect(token.isRevoked()).toBe(true);
    });

    it('should return true for isExpired() if token is expired relative to the expiration time', () => {
      const token = feActionToken.generate({
        createdAt: at(BASE_TIME - 500),
        expiresAt: at(BASE_TIME),
      });
      expect(token.isExpired(at(BASE_TIME - 1_000))).toBe(false);
      expect(token.isExpired(at(BASE_TIME))).toBe(true);
      expect(token.isExpired(at(BASE_TIME + 1_000))).toBe(true);
    });

    it('should return true for isUsable() only if token is not consumed, not revoked, and not expired', () => {
      const token = feActionToken.generate({
        createdAt: at(BASE_TIME),
        expiresAt: at(BASE_TIME + 1_000),
      });
      expect(token.isUsable(at(BASE_TIME))).toBe(true);
      expect(token.isUsable(at(BASE_TIME + 2_000))).toBe(false);
      // Consumed token should also be unusable
      const token2 = feActionToken.generate();
      token2.consume(at(BASE_TIME));
      expect(token2.isUsable(at(BASE_TIME))).toBe(false);
      // Revoked token should also be unusable
      const token3 = feActionToken.generate();
      token3.revoke(ACTION_TOKEN_REVOKE_REASON.MANUAL, at(BASE_TIME));
      expect(token3.isUsable(at(BASE_TIME))).toBe(false);
    });
  });

  describe('getters', () => {
    it('should expose the underlying immutable properties via getters', () => {
      const id = faker.string.uuid();
      const token = feActionToken.generate({
        id,
        userId: 'user-id-456',
        purpose: 'email_verification',
        tokenHash: 'hashed-token',
        createdAt: at(BASE_TIME - 1_000),
        expiresAt: at(BASE_TIME),
      });
      expect(token.id.value).toBe(id);
      expect(token.userId).toBe('user-id-456');
      expect(token.purpose).toBe('email_verification');
      expect(token.tokenHash).toBe('hashed-token');
      expect(token.expiresAt.toEpochMs()).toBe(BASE_TIME);
      expect(token.version).toBe(0);
    });
  });

  describe('serialization', () => {
    const originalSnapshot = fsActionToken.generate({
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      purpose: 'password_reset',
      tokenHash: 'hashed-token-2',
      expiresAt: at(BASE_TIME + 5_000),
      createdAt: at(BASE_TIME),
    });

    it('should include all relevant properties in the snapshot', () => {
      const original = feActionToken.generateFromSnapshot(originalSnapshot);
      const snapshot = original.toSnapshot();
      expect(snapshot.id).toBe(originalSnapshot.id);
      expect(snapshot.userId).toBe(originalSnapshot.userId);
      expect(snapshot.purpose).toBe(originalSnapshot.purpose);
      expect(snapshot.tokenHash).toBe(originalSnapshot.tokenHash);
      expect(snapshot.expiresAt.toEpochMs()).toBe(originalSnapshot.expiresAt.toEpochMs());
      expect(snapshot.createdAt.toEpochMs()).toBe(originalSnapshot.createdAt.toEpochMs());
      expect(snapshot.version).toBe(originalSnapshot.version);
    });

    it('should round-trip through reconstitute() without data loss', () => {
      const original = feActionToken.generateFromSnapshot(originalSnapshot);
      const reconstituted = ActionToken.reconstitute(original.toSnapshot());
      expect(reconstituted.toSnapshot()).toEqual(originalSnapshot);
    });

    it('should reflect mutations made after reconstitution in the snapshot', () => {
      const original = feActionToken.generateFromSnapshot(originalSnapshot);
      original.consume(at(BASE_TIME + 1_000));
      const snapshot = original.toSnapshot();
      expect(snapshot.consumedAt?.toEpochMs()).toBe(BASE_TIME + 1_000);
    });
  });
});
