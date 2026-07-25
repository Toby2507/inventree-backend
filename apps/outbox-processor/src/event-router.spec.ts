import { QUEUE_NAMES } from '@app/core/infrastructure/queue';
import { EventRoutingService } from './event-router';

describe('EventRoutingService', () => {
  let router: EventRoutingService;

  beforeEach(() => {
    router = new EventRoutingService();
  });

  it('should resolve known event types to their corresponding routes', () => {
    const routes = router.resolve('identity.user.registered');
    expect(routes).toEqual(
      expect.arrayContaining([expect.objectContaining({ queue: QUEUE_NAMES.EMAIL })]),
    );
  });

  it('should return an empty array for unknown event types', () => {
    const routes = router.resolve('unknown.event.type');
    expect(routes).toEqual([]);
  });

  it('should not contain undefined routes for known event types', () => {
    Object.keys(router['routes']).forEach((eventType) => {
      const routes = router.resolve(eventType);
      expect(routes.length).toBeGreaterThan(0);
    });
  });
});
