import type { IDisposable } from "../disposable";

/**
 * Common manager contract shared across runtime-managed components.
 */
export interface IManager extends IDisposable {
  readonly name: string;
  readonly type: string;
  initialize?(): void | Promise<void>;
}
