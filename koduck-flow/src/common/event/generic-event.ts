import type { EventConfiguration } from "./types";
import { BaseEvent } from "./base-event";
import type { EventPreset } from "./config";

/**
 * 通用事件类
 *
 * BaseEvent 的具体实现，可用于创建任意类型的简单事件。
 * 替代 Emitter 类的功能，提供相同的便捷API但享受BaseEvent的所有优化。
 */
export class GenericEvent<T> extends BaseEvent<T> {
  constructor(
    eventName: string = "GenericEvent",
    configOrPreset?: Partial<EventConfiguration> | EventPreset
  ) {
    super(eventName, configOrPreset);
  }
}

/**
 * 创建事件发射器的工厂函数
 *
 * 替代 new Emitter<T>() 的使用方式，提供相同的便捷API。
 * 内部使用 BaseEvent 实现，享受批处理和性能优化等所有功能。
 */
export function createEmitter<T>(
  eventName?: string,
  configOrPreset?: Partial<EventConfiguration> | EventPreset
): BaseEvent<T> {
  return new GenericEvent<T>(eventName, configOrPreset);
}
