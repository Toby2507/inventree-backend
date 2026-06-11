interface SyncControllerResponse<T = undefined, P = undefined> {
  code: string;
  message: string;
  data?: T;
  meta?: P;
}
export type ControllerResponse<T = undefined, P = undefined> = Promise<
  SyncControllerResponse<T, P>
>;

export type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P];
};

export type Maybe<T> = T | null | undefined;

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export type Fn = (...args: any) => any;

export type JsonValue =
  | JsonValue[]
  | { [x: string]: JsonValue | undefined }
  | boolean
  | number
  | string
  | null;
