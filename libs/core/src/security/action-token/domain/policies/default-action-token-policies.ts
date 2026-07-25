import { Duration } from '@app/shared-kernel';
import { ACTION_TOKEN_PURPOSES } from '../aggregates/action-token.types';
import { ActionTokenPolicy } from './action-token-policy';

export const DEFAULT_ACTION_TOKEN_POLICIES: ActionTokenPolicy[] = [
  {
    purpose: ACTION_TOKEN_PURPOSES.EMAIL_VERIFICATION,
    ttl: Duration.hours(24),
    singleActiveInstance: true,
  },
  {
    purpose: ACTION_TOKEN_PURPOSES.PASSWORD_RESET,
    ttl: Duration.minutes(30),
    singleActiveInstance: true,
  },
  {
    purpose: ACTION_TOKEN_PURPOSES.EMAIL_CHANGE,
    ttl: Duration.minutes(30),
    singleActiveInstance: true,
  },
  {
    purpose: ACTION_TOKEN_PURPOSES.MAGIC_LOGIN,
    ttl: Duration.minutes(15),
    singleActiveInstance: true,
  },
];
