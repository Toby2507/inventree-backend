export type Maybe<T> = T | null | undefined;

interface SyncControllerResponse<T = undefined, P = undefined> {
  code: string;
  message: string;
  data?: T;
  meta?: P;
}
export type ControllerResponse<T = undefined, P = undefined> = Promise<
  SyncControllerResponse<T, P>
>;
