export const ACTION_TOKEN_PURPOSES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  EMAIL_CHANGE: 'email_change',
  MAGIC_LOGIN: 'magic_login',
} as const;
export type ActionTokenPurpose = (typeof ACTION_TOKEN_PURPOSES)[keyof typeof ACTION_TOKEN_PURPOSES];

export const ACTION_TOKEN_REVOKE_REASONS = {
  MANUAL: 'manual',
  SUPERSEDED: 'superseded',
  ATTEMPTS_EXCEEDED: 'attempts_exceeded',
} as const;
export type ActionTokenRevokeReason =
  (typeof ACTION_TOKEN_REVOKE_REASONS)[keyof typeof ACTION_TOKEN_REVOKE_REASONS];
