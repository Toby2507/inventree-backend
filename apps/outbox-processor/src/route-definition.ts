import { IDENTITY_ROUTES } from '@app/contexts/identity';

export const ROUTE_DEFINITIONS = Symbol('ROUTE_DEFINITIONS');

export const RouteDefinitions = {
  provide: ROUTE_DEFINITIONS,
  useFactory: () => [...IDENTITY_ROUTES],
};
