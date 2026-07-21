import { LOGGER, LoggerPort } from '@app/core/observability';
import { Inject, Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Notification } from 'pg';
import { ListenChannel, DatabaseListenerPort, ListenHandler } from '../ports/listener.port';
import { DATABASE_PROVIDER, DatabaseClient, DatabaseProviderPort } from '../ports/provider.port';

interface Subscription {
  name: string;
  handler: ListenHandler;
}

@Injectable()
export class PgListener
  implements OnApplicationBootstrap, OnApplicationShutdown, DatabaseListenerPort
{
  private readonly logger;
  private client?: DatabaseClient;

  private healthy = false;
  private reconnecting = false;
  private started = false;
  private shuttingDown = false;
  private abortController = new AbortController();
  private readonly listeningChannels = new Set<ListenChannel>();
  private readonly subscriptions = new Map<ListenChannel, Set<Subscription>>();

  constructor(
    @Inject(DATABASE_PROVIDER) private readonly provider: DatabaseProviderPort,
    @Inject(LOGGER) logger: LoggerPort,
  ) {
    this.logger = logger.forContext(PgListener.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }

  get isHealthy(): boolean {
    return this.healthy;
  }

  async start(): Promise<void> {
    if (this.started) return;
    try {
      await this.connect();
      this.started = true;
    } catch (error) {
      this.started = false;
      this.logger.error('Failed to start notification service', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.shuttingDown = true;
    this.healthy = false;
    this.abortController.abort();
    await this.cleanupClient();
    this.started = false;
    this.reconnecting = false;
    this.abortController = new AbortController();
  }

  subscribe(channel: ListenChannel, subscriber: string, handler: ListenHandler): () => void {
    let handlers = this.subscriptions.get(channel);
    if (!handlers) {
      handlers = new Set<Subscription>();
      this.subscriptions.set(channel, handlers);
    }
    const subscription: Subscription = { name: subscriber, handler };
    handlers.add(subscription);
    this.logger.debug('Subscribed to notification channel', { channel, subscriber });
    if (this.healthy) void this.listen(channel);
    return () => this.unsubscribe(channel, subscription);
  }

  // ==== HELPER METHODS =====================
  private readonly handleNotification = (msg: Notification): void => {
    const subscriptions = this.subscriptions.get(msg.channel as ListenChannel);
    if (!subscriptions?.size) return;
    subscriptions.forEach((subscription) => {
      void this.dispatch(subscription, msg.channel as ListenChannel, msg.payload);
    });
  };

  private readonly handleDisconnect = async (): Promise<void> => {
    if (this.shuttingDown || this.reconnecting) return;
    this.logger.warn('Notification connection lost, attempting to reconnect...');
    this.healthy = false;
    await this.cleanupClient();
    void this.reconnect();
  };

  private async connect(): Promise<void> {
    const client = await this.provider.createNotificationClient();
    try {
      this.client = client;
      this.attachListeners();
      this.listeningChannels.clear();
      await this.restoreSubscriptions();
      this.healthy = true;
      this.logger.log('Notification listener connected and ready');
    } catch (error) {
      await this.cleanupClient();
      throw error;
    }
  }

  private attachListeners(): void {
    if (!this.client) return;
    this.client.on('notification', this.handleNotification);
    this.client.once('error', this.handleDisconnect);
    this.client.once('end', this.handleDisconnect);
  }

  private async detachListeners(client: DatabaseClient): Promise<void> {
    client.removeListener('notification', this.handleNotification);
    client.removeListener('error', this.handleDisconnect);
    client.removeListener('end', this.handleDisconnect);
  }

  private async cleanupClient(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (!client) return;
    await this.detachListeners(client);
    await this.destroyClient(client);
  }

  private async destroyClient(client: DatabaseClient): Promise<void> {
    try {
      await this.provider.destroyNotificationClient(client);
    } catch (error) {
      this.logger.warn('Failed to destroy notification client', {
        error: error instanceof Error ? error.stack : String(error),
      });
    }
  }

  private async reconnect(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.abortController = new AbortController();
    try {
      while (!this.shuttingDown) {
        try {
          await this.connect();
          this.logger.log('Notification listener reconnected');
          return;
        } catch (error) {
          this.logger.warn('Failed to reconnect to notification listener', {
            error: error instanceof Error ? error.stack : String(error),
          });
          const completed = await this.delay(5000, this.abortController.signal);
          if (!completed) break;
        }
      }
    } finally {
      this.reconnecting = false;
    }
  }

  private delay(ms: number, signal: AbortSignal, jitter: number = 500): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false);
    const offset = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    const timeout = Math.max(0, ms + offset);
    return new Promise((resolve) => {
      const onAbort = () => {
        cleanup();
        resolve(false);
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve(true);
      }, timeout);
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private async dispatch(
    subscription: Subscription,
    channel: ListenChannel,
    payload?: string,
  ): Promise<void> {
    try {
      await subscription.handler(payload);
    } catch (error) {
      this.logger.error('Notification handler failed', {
        channel,
        subscriber: subscription.name,
        error: error instanceof Error ? error.stack : String(error),
      });
    }
  }

  private async restoreSubscriptions(): Promise<void> {
    if (!this.client) return;
    for (const channel of this.subscriptions.keys())
      await this.listen(channel, { propagateErrors: true });
  }

  private unsubscribe(channel: ListenChannel, subscription: Subscription): void {
    const handlers = this.subscriptions.get(channel);
    if (!handlers) return;
    handlers.delete(subscription);
    if (handlers.size === 0) {
      this.subscriptions.delete(channel);
      if (this.healthy) void this.unlisten(channel);
    }
    this.logger.debug('Unsubscribed from notification channel', {
      channel,
      subscriber: subscription.name,
    });
  }

  private async listen(
    channel: ListenChannel,
    options?: { propagateErrors: boolean },
  ): Promise<void> {
    if (!this.client || this.listeningChannels.has(channel)) return;
    try {
      await this.client.query(`LISTEN ${channel}`);
      this.listeningChannels.add(channel);
      this.logger.debug('Subscribed to notification channel', { channel });
    } catch (error) {
      this.listeningChannels.delete(channel);
      this.logger.warn('Failed to LISTEN to notification channel', {
        channel,
        error: error instanceof Error ? error.stack : String(error),
      });
      if (options?.propagateErrors) throw error;
    }
  }

  private async unlisten(channel: ListenChannel): Promise<void> {
    if (!this.client) return;
    await this.client.query(`UNLISTEN ${channel}`);
    this.listeningChannels.delete(channel);
    this.logger.debug('Unsubscribed from notification channel', { channel });
  }
}
