export interface CleanupExpiredActionTokens {
  execute(): Promise<number>;
}

export const CLEANUP_EXPIRED_TOKENS = Symbol('CLEANUP_EXPIRED_ACTION_TOKENS');
