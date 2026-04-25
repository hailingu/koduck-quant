import type { DuckFlowConfig } from "../schema";
import { logger } from "../../logger";
import type { IConfigState } from "./types/config-state.interface";

/**
 * 配置快照接口
 */
export interface ConfigSnapshot {
  /** 快照ID */
  id: string;
  /** 快照创建时间戳 */
  timestamp: number;
  /** 快照描述 */
  description?: string;
  /** 完整的配置数据 */
  config: DuckFlowConfig;
  /** 快照元数据 */
  metadata: {
    /** 创建者 */
    actor?: string;
    /** 触发原因 */
    trigger: string;
    /** 版本信息 */
    version?: string;
    /** 校验和 */
    checksum: string;
  };
}

/**
 * Rollback操作结果
 */
export interface RollbackResult {
  /** 操作是否成功 */
  success: boolean;
  /** 恢复到的快照ID */
  snapshotId?: string;
  /** 错误信息 */
  error?: string;
  /** 恢复的配置 */
  restoredConfig?: DuckFlowConfig;
  /** 恢复时间戳 */
  timestamp: number;
}

/**
 * Rollback管理器类
 */
export class RollbackManager {
  private readonly snapshots = new Map<string, ConfigSnapshot>();
  private readonly maxSnapshots: number;
  private autoSnapshotEnabled: boolean = true;
  private lastRestoredSnapshotId: string | null = null;
  private lastSnapshotTimestamp = 0;

  constructor(maxSnapshots: number = 10) {
    this.maxSnapshots = maxSnapshots;
    this.autoSnapshotEnabled = true; // 默认启用自动快照
  }

  /**
   * 创建配置快照
   */
  createSnapshot(
    config: DuckFlowConfig,
    description?: string,
    metadata?: Partial<ConfigSnapshot["metadata"]>
  ): ConfigSnapshot {
    const id = this.generateSnapshotId();
    let timestamp = Date.now();
    if (timestamp <= this.lastSnapshotTimestamp) {
      timestamp = this.lastSnapshotTimestamp + 1;
    }
    this.lastSnapshotTimestamp = timestamp;

    // 计算配置校验和
    const checksum = this.calculateChecksum(config);

    const snapshot: ConfigSnapshot = {
      id,
      timestamp,
      config: JSON.parse(JSON.stringify(config)), // 深拷贝
      metadata: {
        trigger: metadata?.trigger || "manual",
        checksum,
        ...(metadata?.actor && { actor: metadata.actor }),
        ...(metadata?.version && { version: metadata.version }),
      },
      ...(description && { description }),
    };

    this.snapshots.set(id, snapshot);

    // 清理旧快照
    this.cleanupOldSnapshots();

    logger.info(`Configuration snapshot created: ${id}`, {
      description,
      checksum,
      actor: metadata?.actor,
    });

    return snapshot;
  }

  /**
   * 自动创建快照（在配置变更前）
   */
  createAutoSnapshot(config: DuckFlowConfig, trigger: string): ConfigSnapshot | null {
    if (!this.autoSnapshotEnabled) {
      return null;
    }

    return this.createSnapshot(config, `Auto-snapshot before ${trigger}`, {
      trigger: `auto-${trigger}`,
      actor: "system",
    });
  }

  /**
   * 回滚到指定快照
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
      // 验证快照完整性
      if (!this.validateSnapshot(snapshot)) {
        const error = `Snapshot validation failed: ${snapshotId}`;
        logger.error(error);
        return {
          success: false,
          error,
          timestamp: Date.now(),
        };
      }

      // 使用 state-manager 设置配置状态
      // 这将自动触发所有订阅的监听器
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
   * 回滚到上一个快照
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

    // 获取当前配置，用于过滤与当前状态相同的快照
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
   * 获取所有快照
   */
  getSnapshots(): ConfigSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取指定快照
   */
  getSnapshot(id: string): ConfigSnapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * 删除快照
   */
  deleteSnapshot(id: string): boolean {
    const deleted = this.snapshots.delete(id);
    if (deleted) {
      logger.info(`Configuration snapshot deleted: ${id}`);
    }
    return deleted;
  }

  /**
   * 清理旧快照
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
   * 生成快照ID
   */
  private generateSnapshotId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `snapshot-${timestamp}-${random}`;
  }

  /**
   * 计算配置校验和
   */
  private calculateChecksum(config: DuckFlowConfig): string {
    const sortedConfig = this.sortObjectKeys(config);
    const configString = JSON.stringify(sortedConfig);
    return this.simpleHash(configString);
  }

  /**
   * 验证快照完整性
   */
  private validateSnapshot(snapshot: ConfigSnapshot): boolean {
    // 验证必需字段
    if (!snapshot.id || !snapshot.config || !snapshot.metadata) {
      throw new Error("Snapshot missing required fields");
    }

    // 验证校验和
    const currentChecksum = this.calculateChecksum(snapshot.config);
    if (currentChecksum !== snapshot.metadata.checksum) {
      throw new Error("Snapshot checksum validation failed");
    }

    return true;
  }

  /**
   * 递归排序对象键
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
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (const char of str) {
      const codePoint = char.codePointAt(0) ?? 0;
      hash = (hash << 5) - hash + codePoint;
      hash = Math.trunc(hash); // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 启用/禁用自动快照
   */
  setAutoSnapshotEnabled(enabled: boolean): void {
    this.autoSnapshotEnabled = enabled;
    logger.info(`Auto-snapshot ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * 获取统计信息
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

// 全局实例
let globalRollbackManager: RollbackManager | null = null;

/**
 * 获取全局rollback管理器实例
 */
export function getRollbackManager(): RollbackManager {
  globalRollbackManager ??= new RollbackManager();
  return globalRollbackManager;
}

/**
 * 创建配置快照
 */
export function createConfigSnapshot(
  config: DuckFlowConfig,
  description?: string,
  metadata?: Partial<ConfigSnapshot["metadata"]>
): ConfigSnapshot {
  return getRollbackManager().createSnapshot(config, description, metadata);
}

/**
 * 回滚到指定快照
 */
export function rollbackToSnapshot(snapshotId: string, configState: IConfigState): RollbackResult {
  return getRollbackManager().rollbackToSnapshot(snapshotId, configState);
}

/**
 * 回滚到上一个快照
 */
export function rollbackToPrevious(configState: IConfigState): RollbackResult {
  return getRollbackManager().rollbackToPrevious(configState);
}
