/**
 * Config state manager implementation
 * Centralizes config state management and decouples state dependencies between modules
 */

import type { KoduckFlowConfig } from "../schema.js";
import type { IConfigState, ConfigChangeListener } from "./types/index.js";

/**
 * Config history entry
 */
interface ConfigHistoryEntry {
  config: KoduckFlowConfig;
  timestamp: number;
  trigger?: string;
}

/**
 * Config state manager
 * Provides read/write, subscription, and history tracking for config state
 */
export class ConfigStateManager implements IConfigState {
  private currentConfig: KoduckFlowConfig;
  private previousConfig: KoduckFlowConfig | undefined;
  private readonly listeners: Set<ConfigChangeListener>;
  private history: ConfigHistoryEntry[];
  private readonly maxHistorySize: number;

  constructor(initialConfig: KoduckFlowConfig, maxHistorySize = 50) {
    this.currentConfig = initialConfig;
    this.previousConfig = undefined;
    this.listeners = new Set();
    this.history = [];
    this.maxHistorySize = maxHistorySize;

    // Record initial config to history
    this.addToHistory(initialConfig, "initialization");
  }

  /**
   * Get current config state
   */
  getCurrentConfig(): KoduckFlowConfig {
    return this.currentConfig;
  }

  /**
   * Set config state
   */
  setCurrentConfig(config: KoduckFlowConfig, silent = false): void {
    const oldConfig = this.currentConfig;
    this.previousConfig = oldConfig;
    this.currentConfig = config;

    // Record to history
    this.addToHistory(config, "manual-update");

    // Trigger listeners
    if (!silent && this.listeners.size > 0) {
      this.notifyListeners(config, oldConfig);
    }
  }

  /**
   * Get previous config state
   */
  getPreviousConfig(): KoduckFlowConfig | undefined {
    return this.previousConfig;
  }

  /**
   * Subscribe to config change events
   */
  subscribe(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(listener);
    };
  }

  /**
   * Unsubscribe from config change events
   */
  unsubscribe(listener: ConfigChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Get all listeners
   */
  getListeners(): ReadonlyArray<ConfigChangeListener> {
    return Array.from(this.listeners);
  }

  /**
   * Clear all listeners
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get config history
   */
  getHistory(limit?: number): ReadonlyArray<ConfigHistoryEntry> {
    if (limit && limit > 0) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Clear config history
   */
  clearHistory(): void {
    // Keep the latest record
    if (this.history.length > 0) {
      const latest = this.history.at(-1)!;
      this.history = [latest];
    } else {
      this.history = [];
    }
  }

  /**
   * Add config to history
   */
  private addToHistory(config: KoduckFlowConfig, trigger?: string): void {
    const entry: ConfigHistoryEntry = {
      config,
      timestamp: Date.now(),
    };
    if (trigger !== undefined) {
      entry.trigger = trigger;
    }
    this.history.push(entry);

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Notify all listeners that config has changed
   */
  private notifyListeners(newConfig: KoduckFlowConfig, oldConfig: KoduckFlowConfig): void {
    for (const listener of this.listeners) {
      try {
        listener(newConfig, oldConfig);
      } catch (error) {
        console.error("Error in config change listener:", error);
      }
    }
  }

  /**
   * Update config and record trigger
   */
  updateConfig(config: KoduckFlowConfig, trigger: string, silent = false): void {
    const oldConfig = this.currentConfig;
    this.previousConfig = oldConfig;
    this.currentConfig = config;

    // Record to history
    this.addToHistory(config, trigger);

    // Trigger listeners
    if (!silent && this.listeners.size > 0) {
      this.notifyListeners(config, oldConfig);
    }
  }

  /**
   * Get listener count
   */
  getListenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Get history size
   */
  getHistorySize(): number {
    return this.history.length;
  }
}
