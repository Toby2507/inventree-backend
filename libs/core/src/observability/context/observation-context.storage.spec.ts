import { faker } from '@app/testing';
import { fsObservationContext } from '@app/testing/core/observability';
import {
  getCorrelationId,
  getObservationContext,
  getOptionalObservationContext,
  observationStorage,
  setObservationContext,
  setObservationContextActor,
} from './observation-context.storage';

describe('ObservationContext Storage', () => {
  const ctx = fsObservationContext.generate();

  describe('getObservationContext()', () => {
    it('should throw when no context is set', () => {
      expect(() => getObservationContext()).toThrow('ObservationContext not initialised');
    });

    it('should return the context when set', (done) => {
      observationStorage.run(ctx, () => {
        expect(getObservationContext()).toBe(ctx);
        done();
      });
    });

    it('should not leak context across sequential runs', (done) => {
      observationStorage.run(ctx, () => {
        expect(getObservationContext()).toBe(ctx);
      });
      expect(() => getObservationContext()).toThrow();
      done();
    });

    it('should isolate nested contexts correctly', (done) => {
      const outer = fsObservationContext.generate({ correlationId: 'outer' });
      const inner = fsObservationContext.generate({ correlationId: 'inner' });
      observationStorage.run(outer, () => {
        expect(getObservationContext().correlationId).toBe('outer');
        observationStorage.run(inner, () => {
          expect(getObservationContext().correlationId).toBe('inner');
        });
        expect(getObservationContext().correlationId).toBe('outer');
        done();
      });
    });

    it('should propagate through async continuations', async () => {
      let capturedId: string | undefined;
      await new Promise<void>((resolve) => {
        observationStorage.run(ctx, async () => {
          await Promise.resolve(); // microtask boundary
          capturedId = getObservationContext().correlationId;
          resolve();
        });
      });
      expect(capturedId).toBe(ctx.correlationId);
    });
  });

  describe('getOptionalObservationContext()', () => {
    it('should return undefined when no context is set', () => {
      expect(getOptionalObservationContext()).toBeUndefined();
    });

    it('should return the context when set', (done) => {
      observationStorage.run(ctx, () => {
        expect(getOptionalObservationContext()).toBe(ctx);
        done();
      });
    });
  });

  describe('getCorrelationId()', () => {
    it('should return the correlationId from context', (done) => {
      observationStorage.run(ctx, () => {
        expect(getCorrelationId()).toBe(ctx.correlationId);
        done();
      });
    });

    it('should return fallback string when no context is set', () => {
      expect(getCorrelationId()).toBe('no-correlation-id');
    });
  });

  describe('setObservationContextActor()', () => {
    const data = { userId: faker.string.uuid(), storeId: faker.string.uuid(), role: 'test-actor' };

    it('should do nothing when no context is set', () => {
      setObservationContextActor(data);
      expect(getOptionalObservationContext()).toBeUndefined();
    });

    it('should update the context actor', (done) => {
      observationStorage.run(ctx, () => {
        setObservationContextActor(data);
        expect(getObservationContext().actor).toEqual(data);
        done();
      });
    });
  });

  describe('setObservationContext()', () => {
    it('should do nothing when no context is set', () => {
      setObservationContext({ correlationId: 'new-id' });
      expect(getOptionalObservationContext()).toBeUndefined();
    });

    it('should update the context with new values', (done) => {
      observationStorage.run(ctx, () => {
        setObservationContext({ correlationId: 'new-id' });
        expect(getObservationContext().correlationId).toBe('new-id');
        done();
      });
    });

    it('should merge with existing context values', (done) => {
      const initial = fsObservationContext.generate({
        correlationId: 'initial-id',
        causationId: 'initial-causation',
      });
      observationStorage.run(initial, () => {
        setObservationContext({ correlationId: 'updated-id' });
        const ctx = getObservationContext();
        expect(ctx.correlationId).toBe('updated-id');
        expect(ctx.causationId).toBe('initial-causation');
        done();
      });
    });
  });
});
