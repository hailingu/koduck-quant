import type { KoduckFlowConfig } from "../schema";
import { logger } from "../../logger";
import type { IConfigState } from "./types/config-state.interface";

/**
 * Config snapshot interface
 */
export interface ConfigSnapshot {
  /** Snapshot ID */
  id: string;
  /** Snapshot creation timestamp */
  timestamp: number;
  /** Snapshot description */
  description?: string;
  /** Full configuration data */
  config: KoduckFlowConfig;
  /** Snapshot metadata */
  metadata: {
    /** Creator */
    actor?: string;
    /** Trigger reason */
    trigger: string;
    /** Version info */
    version?: string;
    /** Checksum */
    checksum: string;
  };
}

/**
 * Rollback operation result
 */
export interface RollbackResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Snapshot ID restored to */
  snapshotId?: string;
  /** Error message */
  error?: string;
  /** Restored configuration */
  restoredConfig?: KoduckFlowConfig;
  /** Restoration timestamp */
  timestamp: number;
}

/**
 * Rollback manager class
 */
export class RollbackManager {
  private readonly snapshots = new Map<string, ConfigSnapshot>();
  private readonly maxSnapshots: number;
  private autoSnapshotEnabled: boolean = true;
  private lastRestoredSnapshotId: string | null = null;
  private lastSnapshotTimestamp = 0;

  constructor(maxSnapshots: number = 10) {
    this.maxSnapshots = maxSnapshots;
    this.autoSnapshotEnabled = true; // Enable auto-snapshot by default
  }

  /**
   * Create configuration snapshot
   */
  createSnapshot(
    config: KoduckFlowConfig,
    description?: string,
    metadata?: Partial<ConfigSnapshot["metadata"]>
  ): ConfigSnapshot {
    const id = this.generateSnapshotId();
    let timestamp = Date.now();
    if (timestamp <= this.lastSnapshotTimestamp) {
      timestamp = this.lastSnapshotTimestamp + 1;
    }
    this.lastSnapshotTimestamp = timestamp;

    // Calculate configuration checksum
    const checksum = this.calculateChecksum(config);

    const snapshot: ConfigSnapshot = {
      id,
      timestamp,
      config: structuredClone(config),
      metadata: {
        trigger: metadata?.trigger || "manual",
        checksum,
        ...(metadata?.actor && { actor: metadata.actor }),
        ...(metadata?.version && { version: metadata.version }),
      },
      ...(description && { description }),
    };

    this.snapshots.set(id, snapshot);

    // Clean up old snapshots
    this.cleanupOldSnapshots();

    logger.info(`Configuration snapshot created: ${id}`, {
      description,
      checksum,
      actor: metadata?.actor,
    });

    return snapshot;
  }

  /**
   * Create auto-snapshot (before config change)
   */
  createAutoSnapshot(config: KoduckFlowConfig, trigger: string): ConfigSnapshot | null {
    if (!this.autoSnapshotEnabled) {
      return null;
    }

    return this.createSnapshot(config, `Auto-snapshot before ${trigger}`, {
      trigger: `auto-${trigger}`,
      actor: "system",
    });
  }

  /**
   * Rollback to specified snapshot
   */
  rollbackToSnapshot(snapshotId: string, configState: IConfigState): RollbackResult {
    const snapshot = this.snapshots.get(snapshotId);

    if (!snapshot) {
      const error = `Snapshot not found: ${snapshotId}`;
      logger.error(error);
      return {
        success: false,
        error,
        timestamp: Date.now(),
      };
    }

    try {
      // Validate snapshot integrity
      if (!this.validateSnapshot(snapshot)) {
        const error = `Snapshot validation failed: ${snapshotId}`;
        logger.error(error);
        return {
          success: false,
          error,
          timestamp: Date.now(),
        };
      }

      // Use state-manager to set configuration state
      // This automatically triggers all subscribed listeners
      configState.setCurrentConfig(snapshot.config);

      logger.info(`Configuration rolled back to snapshot: ${snapshotId}`, {
        description: snapshot.description,
        timestamp: snapshot.timestamp,
      });

      this.lastRestoredSnapshotId = snapshotId;

      return {
        success: true,
        snapshotId,
        restoredConfig: snapshot.config,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Rollback failed for snapshot ${snapshotId}: ${errorMessage}`, { error });

      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Rollback to previous snapshot
   */
  rollbackToPrevious(configState: IConfigState): RollbackResult {
    const snapshots = Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);

    if (snapshots.length === 0) {
      const error = "No previous snapshot available";
      logger.error(error);
      return {
        success: false,
        error,
        timestamp: Date.now(),
      };
    }

    // Get current config to filter snapshots identical to current state
    const currentConfig = configState.getCurrentConfig();
    const currentChecksum = this.calculateChecksum(currentConfig);

    const previousSnapshot = snapshots.find((snapshot) => {
      if (snapshot.metadata.checksum === currentChecksum) {
        return false;
      }
      if (this.lastRestoredSnapshotId && snapshot.id === this.lastRestoredSnapshotId) {
        return false;
      }
      return true;
    });

    if (!previousSnapshot) {
      const error = "No previous snapshot different from current configuration";
      logger.error(error);
      return {
        success: false,
        error,
        timestamp: Date.now(),
      };
    }

    return this.rollbackToSnapshot(previousSnapshot.id, configState);
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): ConfigSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get specified snapshot
   */
  getSnapshot(id: string): ConfigSnapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Delete snapshot
   */
  deleteSnapshot(id: string): boolean {
    const deleted = this.snapshots.delete(id);
    if (deleted) {
      logger.info(`Configuration snapshot deleted: ${id}`);
    }
    return deleted;
  }

  /**
   * Clean up old snapshots
   */
  private cleanupOldSnapshots(): void {
    const snapshots = Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);

    if (snapshots.length > this.maxSnapshots) {
      const toDelete = snapshots.slice(this.maxSnapshots);
      for (const snapshot of toDelete) {
        this.snapshots.delete(snapshot.id);
        logger.debug(`Old snapshot cleaned up: ${snapshot.id}`);
      }
    }
  }

  /**
   * Generate snapshot ID
   */
  private generateSnapshotId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `snapshot-${timestamp}-${random}`;
  }

  /**
   * Calculate configuration checksum
   */
  private calculateChecksum(config: KoduckFlowConfig): string {
    const sortedConfig = this.sortObjectKeys(config);
    const configString = JSON.stringify(sortedConfig);
    return this.simpleHash(configString);
  }

  /**
   * Validate snapshot integrity
   */
  private validateSnapshot(snapshot: ConfigSnapshot): boolean {
    // Validate required fields
    if (!snapshot.id || !snapshot.config || !snapshot.metadata) {
      throw new Error("Snapshot missing required fields");
    }

    // Validate checksum
    const currentChecksum = this.calculateChecksum(snapshot.config);
    if (currentChecksum !== snapshot.metadata.checksum) {
      throw new Error("Snapshot checksum validation failed");
    }

    return true;
  }

  /**
   * Recursively sort object keys
   */
  private sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObjectKeys(item));
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      sorted[key] = this.sortObjectKeys((obj as Record<string, unknown>)[key]);
    }

    return sorted;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (const char of str) {
      const codePoint = char.codePointAt(0) ?? 0;
      hash = (hash << 5) - hash + codePoint;
      hash = Math.trunc(hash); // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Enable/disable auto-snapshot
   */
  setAutoSnapshotEnabled(enabled: boolean): void {
    this.autoSnapshotEnabled = enabled;
    logger.info(`Auto-snapshot ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSnapshots: number;
    maxSnapshots: number;
    autoSnapshotEnabled: boolean;
    oldestSnapshot?: number;
    newestSnapshot?: number;
  } {
    const snapshots = Array.from(this.snapshots.values());

    return {
      totalSnapshots: snapshots.length,
      maxSnapshots: this.maxSnapshots,
      autoSnapshotEnabled: this.autoSnapshotEnabled,
      ...(snapshots.length > 0 && {
        oldestSnapshot: Math.min(...snapshots.map((s) => s.timestamp)),
        newestSnapshot: Math.max(...snapshots.map((s) => s.timestamp)),
      }),
    };
  }
}

// Global instance
let globalRollbackManager: RollbackManager | null = null;

/**
 * Get global rollback manager instance
 */
export function getRollbackManager(): RollbackManager {
  globalRollbackManager ??= new RollbackManager();
  return globalRollbackManager;
}

/**
 * Create configuration snapshot
 */
export function createConfigSnapshot(
  config: KoduckFlowConfig,
  description?: string,
  metadata?: Partial<ConfigSnapshot["metadata"]>
): ConfigSnapshot {
  return getRollbackManager().createSnapshot(config, description, metadata);
}

/**
 * Rollback to specified snapshot
 */
export function rollbackToSnapshot(snapshotId: string, configState: IConfigState): RollbackResult {
  return getRollbackManager().rollbackToSnapshot(snapshotId, configState);
}

/**
 * Rollback to previous snapshot
 */
export function rollbackToPrevious(configState: IConfigState): RollbackResult {
  return getRollbackManager().rollbackToPrevious(configState);
}
