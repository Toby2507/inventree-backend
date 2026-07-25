export const LISTEN_CHANNELS = {
  OUTBOX_PENDING: 'outbox_pending',
} as const;
export type ListenChannel = (typeof LISTEN_CHANNELS)[keyof typeof LISTEN_CHANNELS];

export type ListenHandler = (payload?: string) => void | Promise<void>;

export interface DatabaseListener {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(channel: ListenChannel, subscriberName: string, handler: ListenHandler): () => void;
  isHealthy: boolean;
}

export const DATABASE_LISTENER = Symbol('DATABASE_LISTENER');
