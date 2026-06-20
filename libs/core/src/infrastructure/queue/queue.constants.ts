export enum QUEUE_NAMES {
  NOTIFICATIONS = 'notifications',
  INVENTORY = 'inventory',
  ANALYTICS = 'analytics',
  BILLING = 'billing',
  REPORTS = 'reports',
}

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
