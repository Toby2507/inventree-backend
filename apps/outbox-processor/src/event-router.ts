import type { EventRoute, EventRouteDefinition, EventRouter } from '@app/core/reliability/outbox';
import { Inject, Injectable } from '@nestjs/common';
import { ROUTE_DEFINITIONS } from './route-definition';

@Injectable()
export class EventRoutingService implements EventRouter {
  private readonly routes = new Map<string, EventRoute[]>();

  constructor(@Inject(ROUTE_DEFINITIONS) definitions: EventRouteDefinition[]) {
    for (const { eventType, ...route } of definitions) {
      const existing = this.routes.get(eventType) ?? [];
      existing.push(route);
      this.routes.set(eventType, existing);
    }
  }

  resolve(eventType: string): EventRoute[] {
    return this.routes.get(eventType) ?? [];
  }
}
