export enum ListenChannel {
  OUTBOX_PENDING = 'outbox_pending',
}

export type ListenHandler = (payload?: string) => void | Promise<void>;

export interface DatabaseListenerPort {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(channel: ListenChannel, subscriberName: string, handler: ListenHandler): () => void;
  isHealthy: boolean;
}

export const DATABASE_LISTENER = Symbol('DATABASE_LISTENER');
