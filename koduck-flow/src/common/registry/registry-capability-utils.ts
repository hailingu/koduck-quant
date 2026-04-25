/**
 * RegistryCapabilityUtils (精简版)
 * 目标: 统一三种能力来源, 降低分支复杂度, 避免再次出现漏检导致的渲染 fallback。
 * 能力来源优先级 (短路策略) - 统一后语义：
 *   1. 显式接口: hasCapability / executeCapability / listCapabilities / getCapabilities
 *   2. meta.extras.capabilities (唯一的规范存储位置，可能为 string[] 或 ICapability[])
 * 根因记录: 曾因只读旧结构导致动态 registry 能力漏检，本次彻底规范化为 extras.capabilities。
 */

import type { ICapability } from "../../utils";
import type { IEntity } from "../entity";
import type { IRegistry } from "./types";

// ---- 类型守卫 ----
interface LegacyCapabilityLike extends ICapability {
  name: string;
}
interface CapabilityAwareLike {
  hasCapability?: (n: string) => boolean;
  executeCapability?: (
    n: string,
    entity: IEntity,
    ...args: unknown[]
  ) => unknown;
  listCapabilities?: () => string[]; // 可选增强
  getCapabilities?: () => string[]; // 兼容之前尝试
  meta?: {
    capabilities?: string[];
    extras?: { capabilities?: unknown };
  };
}

function isCapabilityAware(registry: unknown): registry is CapabilityAwareLike {
  return (
    !!registry &&
    typeof registry === "object" &&
    ("hasCapability" in (registry as CapabilityAwareLike) ||
      "executeCapability" in (registry as CapabilityAwareLike))
  );
}

// 统一获取名称 (不做缓存 — 渲染频率可控, 若需可后续加入 WeakMap 缓存)
function collectCapabilityNames(registry: CapabilityAwareLike): string[] {
  // 1. 显式列出
  if (typeof registry.listCapabilities === "function") {
    try {
      const listed = registry.listCapabilities();
      if (Array.isArray(listed)) return listed;
    } catch {
      /* ignore */
    }
  }
  if (typeof registry.getCapabilities === "function") {
    try {
      const legacy = registry.getCapabilities();
      if (Array.isArray(legacy)) return legacy;
    } catch {
      /* ignore */
    }
  }
  // 2. meta.extras.capabilities (规范位置)
  const extrasAny = registry.meta?.extras as
    | { capabilities?: unknown }
    | undefined;
  const raw = extrasAny?.capabilities;
  if (Array.isArray(raw) && raw.length > 0) {
    if (typeof raw[0] === "string") return raw as string[];
    const first = raw[0] as unknown;
    if (
      typeof first === "object" &&
      first !== null &&
      "name" in (first as { name?: unknown })
    ) {
      return (raw as LegacyCapabilityLike[]).map((c) => c.name);
    }
  }
  return [];
}

// 为了兼容旧调用 (期望 ICapability[])，把纯字符串映射成最小 ICapability。
function materializeCapabilities(registry: CapabilityAwareLike): ICapability[] {
  // 从规范位置读取 extras.capabilities (如果是 ICapability[] 则直接返回)
  const extrasAny = registry.meta?.extras as
    | { capabilities?: unknown }
    | undefined;
  const raw = extrasAny?.capabilities;
  if (Array.isArray(raw) && raw.length > 0) {
    if (typeof raw[0] !== "string") {
      const first = raw[0] as unknown;
      if (
        typeof first === "object" &&
        first !== null &&
        "name" in (first as { name?: unknown })
      ) {
        return raw as ICapability[];
      }
    }
  }
  // 否则用名称构造虚拟能力对象（名称来源已按新优先级统一）
  return collectCapabilityNames(registry).map((name) => ({
    name,
    canHandle: () => true,
    execute: () => undefined,
  }));
}

export class RegistryCapabilityUtils {
  /**
   * 返回 ICapability[] (可能是虚拟包装)
   */
  static getCapabilities(registry: IRegistry<IEntity>): ICapability[] {
    return materializeCapabilities(registry as CapabilityAwareLike);
  }

  static hasCapability(registry: IRegistry<IEntity>, name: string): boolean {
    const r = registry as CapabilityAwareLike;
    if (isCapabilityAware(r) && typeof r.hasCapability === "function") {
      try {
        return !!r.hasCapability(name);
      } catch {
        /* fallback */
      }
    }
    return collectCapabilityNames(r).includes(name);
  }

  static hasRenderCapability(registry: IRegistry<IEntity>): boolean {
    return this.hasCapability(registry, "render");
  }

  static hasExecuteCapability(registry: IRegistry<IEntity>): boolean {
    return this.hasCapability(registry, "execute");
  }

  static async executeCapability(
    registry: IRegistry<IEntity>,
    name: string,
    entity: IEntity,
    ...args: unknown[]
  ): Promise<unknown> {
    const r = registry as CapabilityAwareLike;
    if (isCapabilityAware(r) && typeof r.executeCapability === "function") {
      if (r.hasCapability && !r.hasCapability(name)) {
        throw new Error(`Capability "${name}" not found in registry`);
      }
      return await r.executeCapability(name, entity, ...args);
    }
    const caps = materializeCapabilities(r);
    const cap = caps.find((c) => c.name === name);
    if (!cap) throw new Error(`Capability "${name}" not found`);
    if (!cap.canHandle(entity, ...args)) {
      throw new Error(`Capability "${name}" cannot handle entity ${entity.id}`);
    }
    return await cap.execute(entity, ...args);
  }
}
