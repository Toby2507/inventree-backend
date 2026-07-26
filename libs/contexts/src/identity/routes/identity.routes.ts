import type { EventRouteDefinition } from '@app/core/reliability/outbox';
import { USER_REGISTERED_ROUTES } from './user-registered.route';

export const IDENTITY_ROUTES: EventRouteDefinition[] = [...USER_REGISTERED_ROUTES];
