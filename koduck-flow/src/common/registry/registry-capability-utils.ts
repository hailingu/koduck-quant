/**
 * RegistryCapabilityUtils (lite version)
 * Goal: unify three capability sources, reduce branch complexity, avoid rendering fallback caused by missed detection.
 * Capability source priority (short-circuit strategy) - unified semantics:
 * 1. Explicit interface: hasCapability / executeCapability / listCapabilities / getCapabilities
 * 2. meta.extras.capabilities (the canonical storage location, may be string[] or ICapability[])
 * Root cause record: dynamic registry capabilities were previously missed due to reading only the old structure; now fully normalized to extras.capabilities.
 */

import type { ICapability } from "../../utils";
import type { IEntity } from "../entity";
import type { IRegistry } from "./types";

// ---- Type guards ----
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
  listCapabilities?: () => string[]; // Optional enhancement
  getCapabilities?: () => string[]; // Compatibility with previous attempt
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

// Unified name retrieval (no caching — rendering frequency is controllable; WeakMap cache can be added later if needed)
function collectCapabilityNames(registry: CapabilityAwareLike): string[] {
  // 1. Explicit listing
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
  // 2. meta.extras.capabilities (canonical location)
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

// For backward compatibility with old calls (expecting ICapability[]), map plain strings to minimal ICapability.
function materializeCapabilities(registry: CapabilityAwareLike): ICapability[] {
  // Read extras.capabilities from canonical location (return directly if already ICapability[])
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
  // Otherwise construct virtual capability objects from names (name source already unified by new priority)
  return collectCapabilityNames(registry).map((name) => ({
    name,
    canHandle: () => true,
    execute: () => undefined,
  }));
}

export class RegistryCapabilityUtils {
  /**
   * Returns ICapability[] (may be virtual wrapper)
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
