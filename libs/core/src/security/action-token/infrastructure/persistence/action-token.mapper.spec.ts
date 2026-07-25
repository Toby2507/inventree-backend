import { fdActionToken, feActionToken } from '@app/testing/core/security';
import { ActionTokenMapper } from './action-token.mapper';

describe('ActionToken Mapper', () => {
  let mapper: ActionTokenMapper;

  beforeEach(() => {
    mapper = new ActionTokenMapper();
  });

  describe('toDomain()', () => {
    it('should map ActionTokenRow to ActionToken domain entity', () => {
      const raw = fdActionToken.generate();
      const token = mapper.toDomain(raw);
      const snapshot = token.toSnapshot();
      expect(snapshot.id).toBe(raw.id);
      expect(snapshot.userId).toBe(raw.user_id);
      expect(snapshot.purpose).toBe(raw.purpose);
      expect(snapshot.tokenHash).toBe(raw.token_hash);
      expect(snapshot.createdAt.toDate()).toEqual(raw.created_at);
      expect(snapshot.expiresAt.toDate()).toEqual(raw.expires_at);
      expect(snapshot.consumedAt?.toDate()).toEqual(raw.consumed_at);
      expect(snapshot.revokedAt?.toDate()).toEqual(raw.revoked_at);
      expect(snapshot.revokedReason).toBe(raw.revoked_reason);
      expect(snapshot.version).toBe(raw.version);
    });

    it('should map null values correctly', () => {
      const raw = fdActionToken.generate({
        consumed_at: null,
        revoked_at: null,
        revoked_reason: null,
      });
      const token = mapper.toDomain(raw);
      const snapshot = token.toSnapshot();
      expect(snapshot.consumedAt).toBeNull();
      expect(snapshot.revokedAt).toBeNull();
      expect(snapshot.revokedReason).toBeNull();
    });
  });

  describe('toPersistence()', () => {
    it('should map ActionToken domain aggregate to persistence data', () => {
      const tokenEntity = feActionToken.generate();
      const tokenSnap = tokenEntity.toSnapshot();
      const raw = mapper.toPersistence(tokenEntity);
      expect(raw.id).toBe(tokenSnap.id);
      expect(raw.user_id).toBe(tokenSnap.userId);
      expect(raw.purpose).toBe(tokenSnap.purpose);
      expect(raw.token_hash).toBe(tokenSnap.tokenHash);
      expect(raw.created_at).toEqual(tokenSnap.createdAt.toDate());
      expect(raw.expires_at).toEqual(tokenSnap.expiresAt.toDate());
      expect(raw.consumed_at).toEqual(tokenSnap.consumedAt?.toDate());
      expect(raw.revoked_at).toEqual(tokenSnap.revokedAt?.toDate());
      expect(raw.revoked_reason).toBe(tokenSnap.revokedReason);
      expect(raw.version).toBe(tokenSnap.version);
    });

    it('should map null values correctly', () => {
      const tokenEntity = feActionToken.generateFromSnapshot({
        consumedAt: null,
        revokedAt: null,
        revokedReason: null,
      });
      const raw = mapper.toPersistence(tokenEntity);
      expect(raw.consumed_at).toBeNull();
      expect(raw.revoked_at).toBeNull();
      expect(raw.revoked_reason).toBeNull();
    });
  });

  describe('round-trip consistency', () => {
    it('should preserve data through persistence round trip', () => {
      const original = feActionToken.generate();
      const persistence = mapper.toPersistence(original);
      const reconstructed = mapper.toDomain(persistence);
      expect(reconstructed.toSnapshot()).toEqual(original.toSnapshot());
    });

    it('should preserve nullable fields through round trip', () => {
      const original = feActionToken.generateFromSnapshot({
        consumedAt: null,
        revokedAt: null,
        revokedReason: null,
      });
      const persistence = mapper.toPersistence(original);
      const reconstructed = mapper.toDomain(persistence);
      expect(reconstructed.toSnapshot()).toEqual(original.toSnapshot());
    });
  });
});
