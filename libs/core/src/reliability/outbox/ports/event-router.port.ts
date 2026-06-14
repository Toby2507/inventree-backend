export interface EventRoute {
  queue: string;
  jobName?: string;
}

export interface EventRouterPort {
  resolve(eventType: string): EventRoute[];
}

export const EVENT_ROUTER = Symbol('EVENT_ROUTER');
