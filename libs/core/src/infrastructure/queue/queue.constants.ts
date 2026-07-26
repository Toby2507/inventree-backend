export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  INVENTORY: 'inventory',
  ANALYTICS: 'analytics',
  BILLING: 'billing',
  REPORTS: 'reports',
  EMAIL: 'email',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
