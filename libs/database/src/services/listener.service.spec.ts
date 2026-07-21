import { makeLoggerMock } from '@app/testing/core/observability';
import { makeDatabaseProviderMock } from '@app/testing/database';
import { ListenChannel } from '../ports/listener.port';
import { PgListener } from './listener.service';

const flushPromises = () => new Promise(setImmediate);

describe('PgListener', () => {
  let listener: PgListener;

  const dbProvider = makeDatabaseProviderMock();
  const { logger, contextLogger } = makeLoggerMock();

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new PgListener(dbProvider, logger);
  });
  afterEach(async () => {
    if (listener['started']) await listener.stop();
    dbProvider.recreateClient();
    jest.useRealTimers();
  });

  describe('lifecycle', () => {
    describe('start', () => {
      it('should connect on start()', async () => {
        await listener.start();
        expect(dbProvider.createNotificationClient).toHaveBeenCalled();
        expect(listener.isHealthy).toBe(true);
      });

      it('should be no-op if start() is called while already started', async () => {
        await listener.start();
        await listener.start();
        expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(1);
      });

      it('should throw and log error if connection fails', async () => {
        dbProvider.createNotificationClient.mockRejectedValueOnce(new Error('Connection failed'));
        await expect(listener.start()).rejects.toThrow('Connection failed');
        expect(listener.isHealthy).toBe(false);
        expect(contextLogger.error).toHaveBeenCalledWith(
          'Failed to start notification service',
          expect.objectContaining({ error: expect.any(Error) }),
        );
      });

      it('should leave started=false if connection fails allowing for retry', async () => {
        dbProvider.createNotificationClient.mockRejectedValueOnce(new Error('Connection failed'));
        await expect(listener.start()).rejects.toThrow('Connection failed');
        await listener.start();
        expect(listener.isHealthy).toBe(true);
      });

      it('should destroy the client if restoring subscriptions fails', async () => {
        listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        dbProvider.client.query.mockRejectedValueOnce(new Error('LISTEN failed'));
        await expect(listener.start()).rejects.toThrow('LISTEN failed');
        expect(dbProvider.destroyNotificationClient).toHaveBeenCalledWith(dbProvider.client);
        expect(listener.isHealthy).toBe(false);
      });

      it('should delegate to start() on application bootstrap', async () => {
        await listener.onApplicationBootstrap();
        expect(dbProvider.createNotificationClient).toHaveBeenCalled();
        expect(listener.isHealthy).toBe(true);
      });
    });

    describe('stop', () => {
      it('should be no-op if stop() is called while not started', async () => {
        await listener.stop();
        expect(dbProvider.createNotificationClient).not.toHaveBeenCalled();
      });

      it('should tear down the connection and mark the service as unhealthy', async () => {
        await listener.start();
        await listener.stop();
        expect(dbProvider.destroyNotificationClient).toHaveBeenCalledWith(dbProvider.client);
        expect(listener.isHealthy).toBe(false);
      });

      it('should log a warning if destroyNotificationClient fails', async () => {
        await listener.start();
        dbProvider.destroyNotificationClient.mockRejectedValueOnce(new Error('Destroy failed'));
        await listener.stop();
        expect(contextLogger.warn).toHaveBeenCalledWith(
          'Failed to destroy notification client',
          expect.objectContaining({ error: expect.anything() }),
        );
      });

      it('should allow for restart after stop()', async () => {
        await listener.start();
        await listener.stop();
        expect(listener.isHealthy).toBe(false);
        await listener.start();
        expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(2);
        expect(listener.isHealthy).toBe(true);
      });

      it('should delegate to stop() on application shutdown', async () => {
        await listener.start();
        await listener.onApplicationShutdown();
        expect(dbProvider.destroyNotificationClient).toHaveBeenCalledWith(dbProvider.client);
        expect(listener.isHealthy).toBe(false);
      });
    });
  });

  describe('subscription flow', () => {
    describe('subscribe', () => {
      it('should subscribe to a channel and receive notifications when healthy', async () => {
        await listener.start();
        listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        await flushPromises();
        expect(dbProvider.client.query).toHaveBeenCalledWith('LISTEN orders');
      });

      it('should not attempt to subscribe when unhealthy', async () => {
        listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        await flushPromises();
        expect(dbProvider.client.query).not.toHaveBeenCalledWith('LISTEN orders');
      });

      it('should only subscribe once per channel even if multiple subscriptions exist', async () => {
        await listener.start();
        listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        await flushPromises();
        listener.subscribe('orders' as ListenChannel, 'sub-b', jest.fn());
        await flushPromises();
        expect(dbProvider.client.query).toHaveBeenCalledTimes(1);
        expect(dbProvider.client.query).toHaveBeenCalledWith('LISTEN orders');
      });

      it('should restore subscriptions made before start() on connect', async () => {
        listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        listener.subscribe('invoices' as ListenChannel, 'sub-b', jest.fn());
        await listener.start();
        expect(dbProvider.client.query).toHaveBeenCalledWith('LISTEN orders');
        expect(dbProvider.client.query).toHaveBeenCalledWith('LISTEN invoices');
      });

      it('should catch, log, but not throw a post-startup subscription error', async () => {
        await listener.start();
        dbProvider.client.query.mockRejectedValueOnce(new Error('LISTEN failed'));
        listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        await flushPromises();
        expect(contextLogger.warn).toHaveBeenCalledWith(
          'Failed to LISTEN to notification channel',
          expect.objectContaining({ channel: 'orders' }),
        );
      });
    });

    describe('unsubscribe', () => {
      it('should remove only the given handler leaving the channel subscribed with other handlers', async () => {
        await listener.start();
        const handlerA = jest.fn();
        const handlerB = jest.fn();
        const unsubscribeA = listener.subscribe('orders' as ListenChannel, 'sub-a', handlerA);
        listener.subscribe('orders' as ListenChannel, 'sub-b', handlerB);
        await flushPromises();
        unsubscribeA();
        dbProvider.client.emit('notification', { channel: 'orders', payload: 'test' });
        await flushPromises();
        expect(handlerA).not.toHaveBeenCalled();
        expect(handlerB).toHaveBeenCalledWith('test');
      });

      it('should unsubscribe from the channel when the last handler is removed and service is healthy', async () => {
        await listener.start();
        const unsub = listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        await flushPromises();
        unsub();
        await flushPromises();
        expect(dbProvider.client.query).toHaveBeenCalledWith('UNLISTEN orders');
      });

      it('should be no-op when unsubscribing from a channel and service is unhealthy', async () => {
        const unsub = listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        unsub();
        expect(dbProvider.client.query).not.toHaveBeenCalledWith('UNLISTEN orders');
      });

      it('should be no-op when unsubscribing and unknown channel', async () => {
        const unsub = listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
        unsub(); // At this point 'orders' becomes an unknown channel since there are no more subscribers
        expect(() => unsub()).not.toThrow();
      });
    });
  });

  describe('notification handling', () => {
    beforeEach(async () => {
      await listener.start();
    });

    it('should invoke all registered handlers for the notified channel', async () => {
      const handlerA = jest.fn();
      const handlerB = jest.fn();
      listener.subscribe('orders' as ListenChannel, 'sub-a', handlerA);
      listener.subscribe('orders' as ListenChannel, 'sub-b', handlerB);
      await flushPromises();
      dbProvider.client.emit('notification', { channel: 'orders', payload: 'test' });
      await flushPromises();
      expect(handlerA).toHaveBeenCalledWith('test');
      expect(handlerB).toHaveBeenCalledWith('test');
    });

    it('should ignore notifications for channels with no registered handlers', async () => {
      expect(() => {
        dbProvider.client.emit('notification', { channel: 'orders', payload: 'test' });
      }).not.toThrow();
    });

    it('should not deliver notifications to subscribers of other channels', async () => {
      const handlerA = jest.fn();
      const handlerB = jest.fn();
      listener.subscribe('orders' as ListenChannel, 'sub-a', handlerA);
      listener.subscribe('invoices' as ListenChannel, 'sub-b', handlerB);
      await flushPromises();
      dbProvider.client.emit('notification', { channel: 'orders', payload: 'test' });
      await flushPromises();
      expect(handlerA).toHaveBeenCalled();
      expect(handlerB).not.toHaveBeenCalled();
    });

    it("should catch and log a handler's error without affecting other handlers", async () => {
      const failing = jest.fn().mockRejectedValue(new Error('Handler failed'));
      const succeeding = jest.fn();
      listener.subscribe('orders' as ListenChannel, 'sub-fail', failing);
      listener.subscribe('orders' as ListenChannel, 'sub-ok', succeeding);
      await flushPromises();
      dbProvider.client.emit('notification', { channel: 'orders', payload: 'test' });
      await flushPromises();
      expect(failing).toHaveBeenCalledWith('test');
      expect(succeeding).toHaveBeenCalledWith('test');
      expect(contextLogger.error).toHaveBeenCalledWith(
        'Notification handler failed',
        expect.objectContaining({ channel: 'orders', subscriber: 'sub-fail' }),
      );
    });
  });

  describe('disconnection and reconnection handling', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await listener.start();
    });

    it('should mark the listener as unhealthy and destroy the client on disconnection', async () => {
      dbProvider.client.emit('error', new Error('Simulated disconnect'));
      expect(listener.isHealthy).toBe(false);
      await jest.advanceTimersByTimeAsync(0);
      expect(dbProvider.destroyNotificationClient).toHaveBeenCalledWith(dbProvider.client);
    });

    it('should attempt to reconnect after disconnection', async () => {
      dbProvider.client.emit('error', new Error('Simulated disconnect'));
      expect(listener.isHealthy).toBe(false);
      await jest.advanceTimersByTimeAsync(0);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(2);
      expect(listener.isHealthy).toBe(true);
    });

    it('should retry with delay if reconnection attempts fail initially', async () => {
      dbProvider.createNotificationClient
        .mockRejectedValueOnce(new Error('Client down'))
        .mockRejectedValueOnce(new Error('Client sill down'))
        .mockResolvedValueOnce(dbProvider.client);
      dbProvider.client.emit('end');
      // The first reconnection attempt fails
      await jest.advanceTimersByTimeAsync(0);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(2);
      expect(listener.isHealthy).toBe(false);
      // The second reconnection attempt fails
      await jest.advanceTimersByTimeAsync(5500);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(3);
      expect(listener.isHealthy).toBe(false);
      // The third reconnection attempt succeeds
      await jest.advanceTimersByTimeAsync(5500);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(4);
      expect(listener.isHealthy).toBe(true);
    });

    it('should restore subscriptions after reconnection', async () => {
      listener.subscribe('orders' as ListenChannel, 'sub-a', jest.fn());
      await jest.advanceTimersByTimeAsync(0);
      dbProvider.client.emit('end');
      await jest.advanceTimersByTimeAsync(0);
      expect(dbProvider.client.query).toHaveBeenCalledWith('LISTEN orders');
    });

    it('should not attempt to reconnect twice concurrently', async () => {
      dbProvider.client.emit('end');
      dbProvider.client.emit('error', new Error('Simulated disconnect'));
      await jest.advanceTimersByTimeAsync(0);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(2); // One for start, one for reconnect
    });

    it('should stop retrying once stop() is called mid-reconnection', async () => {
      dbProvider.createNotificationClient.mockRejectedValueOnce(new Error('Client down'));
      dbProvider.client.emit('end');
      await jest.advanceTimersByTimeAsync(0);
      expect(listener.isHealthy).toBe(false);
      await listener.stop();
      dbProvider.createNotificationClient.mockClear();
      await jest.advanceTimersByTimeAsync(10000);
      expect(dbProvider.createNotificationClient).not.toHaveBeenCalled();
    });

    it('should ignore disconnection events while shutting down', async () => {
      const stopPromise = listener.stop();
      dbProvider.client.emit('end');
      await stopPromise;
      await jest.advanceTimersByTimeAsync(0);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(1); // Only the initial start
    });
  });

  describe('reconnection delay abortion signal handling', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      dbProvider.createNotificationClient.mockResolvedValue(dbProvider.client);
      await listener.start();
    });
    afterEach(() => {
      dbProvider.createNotificationClient.mockReset();
    });

    it('should reset the retry timer if stop() is called during a reconnection delay', async () => {
      dbProvider.createNotificationClient.mockRejectedValue(new Error('Client down'));
      dbProvider.client.emit('end');
      await jest.advanceTimersByTimeAsync(0);
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      await listener.stop();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should not attempt to reconnect if the delay is aborted', async () => {
      dbProvider.createNotificationClient.mockRejectedValue(new Error('Client down'));
      dbProvider.client.emit('end');
      await jest.advanceTimersByTimeAsync(0);
      const callsBeforeAbort = dbProvider.createNotificationClient.mock.calls.length;
      await listener.stop();
      await jest.advanceTimersByTimeAsync(10_000);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(callsBeforeAbort); // No new calls after abort
    });

    it('should resolve the delay immediately on abort', async () => {
      dbProvider.createNotificationClient.mockRejectedValue(new Error('Client down'));
      dbProvider.client.emit('end');
      await jest.advanceTimersByTimeAsync(0);
      await listener.stop();
      expect(listener['reconnecting']).toBe(false);
    });

    it('should use a fresh abort controller per reconnection attempt', async () => {
      dbProvider.createNotificationClient.mockRejectedValue(new Error('Client down'));
      dbProvider.client.emit('end');
      await jest.advanceTimersByTimeAsync(0);
      // Capture the first abort controller after reconnection attempt since a new controller is created in reconnect()
      const firstAbortController = listener['abortController'];
      await listener.stop();
      expect(firstAbortController).toBeInstanceOf(AbortController);
      expect(firstAbortController.signal.aborted).toBe(true);
      dbProvider.recreateClient(); // Create a new mock client for the next connection attempt
      dbProvider.createNotificationClient.mockReset();
      await listener.start();
      dbProvider.createNotificationClient
        .mockRejectedValueOnce(new Error('Client down'))
        .mockResolvedValueOnce(dbProvider.client);
      dbProvider.client.emit('end');
      await jest.advanceTimersByTimeAsync(0);
      const secondAbortController = listener['abortController'];
      expect(secondAbortController).toBeInstanceOf(AbortController);
      expect(secondAbortController).not.toBe(firstAbortController);
      expect(secondAbortController.signal.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(5500);
      expect(listener.isHealthy).toBe(true);
    });

    it('should apply jitter within the configured bounds around the delay', async () => {
      dbProvider.createNotificationClient
        .mockRejectedValueOnce(new Error('Client down'))
        .mockResolvedValue(dbProvider.client);
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // produces -500ms offset -> 4500ms total delay
      dbProvider.client.emit('end');
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(4499);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1);
      expect(dbProvider.createNotificationClient).toHaveBeenCalledTimes(3);
      randomSpy.mockRestore();
    });
  });
});
