export const ACTION_TOKEN_PURPOSE = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  EMAIL_CHANGE: 'email_change',
  MAGIC_LOGIN: 'magic_login',
} as const;
export type ActionTokenPurpose = (typeof ACTION_TOKEN_PURPOSE)[keyof typeof ACTION_TOKEN_PURPOSE];

export const ACTION_TOKEN_REVOKE_REASON = {
  MANUAL: 'manual',
  SUPERSEDED: 'superseded',
  ATTEMPTS_EXCEEDED: 'attempts_exceeded',
} as const;
export type ActionTokenRevokeReason =
  (typeof ACTION_TOKEN_REVOKE_REASON)[keyof typeof ACTION_TOKEN_REVOKE_REASON];
