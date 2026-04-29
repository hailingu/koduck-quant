import type { IEdge, IEndpoint } from "./types";
import { meter, ScopedMeter } from "../metrics";

/**
 * Edge 的默认实现
 * 基于 IEdge 接口，实现支持多个源和目标端点的边管理。
 */
type EdgeData = {
  weight?: number;
  label?: string;
  style?: Record<string, unknown>;
  enabled?: boolean;
  [key: string]: unknown;
};

type EdgeConfig = {
  allowSelfLoop?: boolean;
  validator?: (source: IEndpoint, target: IEndpoint) => boolean;
  onCreate?: (edge: Edge) => void;
  onDestroy?: (edge: Edge) => void;
};

export class Edge implements IEdge {
  private readonly m = new ScopedMeter(meter("flow"), { component: "Edge" });
  private _sources: IEndpoint[];
  private _targets: IEndpoint[];
  private _isValid: boolean = true;
  private _state: "active" | "inactive" | "disabled" = "active";
  private _edgeData: EdgeData | undefined;
  private _edgeConfig: EdgeConfig | undefined;

  constructor(sources: IEndpoint[], targets: IEndpoint[], config?: EdgeConfig) {
    this._sources = sources;
    this._targets = targets;
    this._edgeConfig = config;

    // 验证边的有效性
    this._validateEdge();

    // 调用创建回调
    config?.onCreate?.(this);
    this.m.counter("edge.created").add(1);
  }

  // 端点和节点
  get sources(): IEndpoint[] {
    return [...this._sources];
  }

  get targets(): IEndpoint[] {
    return [...this._targets];
  }

  get sourceIds(): string[] {
    return this._sources.map((s) => s.nodeId);
  }

  get targetIds(): string[] {
    return this._targets.map((t) => t.nodeId);
  }

  get sourcePorts(): IEndpoint["port"][] {
    return this._sources.map((s) => s.port);
  }

  get targetPorts(): IEndpoint["port"][] {
    return this._targets.map((t) => t.port);
  }

  // 状态
  get isValid(): boolean {
    return this._isValid;
  }

  get state(): "active" | "inactive" | "disabled" {
    return this._state;
  }

  get edgeData(): EdgeData | undefined {
    return this._edgeData;
  }

  set edgeData(data: EdgeData | undefined) {
    this._edgeData = data;
  }

  get edgeConfig(): EdgeConfig | undefined {
    return this._edgeConfig;
  }

  set edgeConfig(config: EdgeConfig | undefined) {
    this._edgeConfig = config;
  }

  // 状态管理
  setState(state: "active" | "inactive" | "disabled"): void {
    this._state = state;
    this.m.counter("edge.state_changed").add(1, { state });
  }

  activate(): void {
    this.setState("active");
  }

  deactivate(): void {
    this.setState("inactive");
  }

  disable(): void {
    this.setState("disabled");
  }

  isActive(): boolean {
    return this._state === "active";
  }

  // 连接检查
  connectsNode(nodeId: string): boolean {
    return this.sourceIds.includes(nodeId) || this.targetIds.includes(nodeId);
  }

  connectsNodes(node1: string, node2: string): boolean {
    const sourceNodes = this.sourceIds;
    const targetNodes = this.targetIds;
    return (
      (sourceNodes.includes(node1) && targetNodes.includes(node2)) ||
      (sourceNodes.includes(node2) && targetNodes.includes(node1))
    );
  }

  getOtherNodes(nodeId: string): string[] {
    const others: string[] = [];
    if (this.sourceIds.includes(nodeId)) {
      others.push(...this.targetIds);
    }
    if (this.targetIds.includes(nodeId)) {
      others.push(...this.sourceIds);
    }
    return [...new Set(others)]; // 去重
  }

  isSelfLoop(): boolean {
    return this.sourceIds.some((s) => this.targetIds.includes(s));
  }

  // 更新和操作
  updateSources(sources: IEndpoint[]): void {
    const start = performance.now();
    this._sources = sources;
    this._validateEdge();
    const dur = performance.now() - start;
    this.m.counter("edge.sources_updated").add(1);
    this.m.histogram("edge.update.duration.ms", { unit: "ms" }).record(dur, {
      part: "sources",
    });
  }

  updateTargets(targets: IEndpoint[]): void {
    const start = performance.now();
    this._targets = targets;
    this._validateEdge();
    const dur = performance.now() - start;
    this.m.counter("edge.targets_updated").add(1);
    this.m.histogram("edge.update.duration.ms", { unit: "ms" }).record(dur, {
      part: "targets",
    });
  }

  reverse(): void {
    const temp = this._sources;
    this._sources = this._targets;
    this._targets = temp;
    this._validateEdge();
    this.m.counter("edge.reversed").add(1);
  }

  clone(): IEdge {
    const cloned = new Edge(
      this._sources.map((s) => ({ ...s })),
      this._targets.map((t) => ({ ...t })),
      this._edgeConfig
    );
    if (this._edgeData) {
      cloned.edgeData = { ...this._edgeData };
    }
    this.m.counter("edge.cloned").add(1);
    return cloned;
  }

  // 数据操作
  getWeight(): number {
    return this._edgeData?.weight ?? 1;
  }

  setWeight(weight: number): void {
    this._edgeData ??= {};
    this._edgeData.weight = weight;
  }

  getLabel(): string | undefined {
    return this._edgeData?.label;
  }

  setLabel(label: string): void {
    this._edgeData ??= {};
    this._edgeData.label = label;
  }

  getStyle(): Record<string, unknown> | undefined {
    return this._edgeData?.style;
  }

  setStyle(style: Record<string, unknown>): void {
    this._edgeData ??= {};
    this._edgeData.style = { ...(this._edgeData.style || {}), ...style };
  }

  isEnabled(): boolean {
    return this._edgeData?.enabled !== false;
  }

  setEnabled(enabled: boolean): void {
    this._edgeData ??= {};
    this._edgeData.enabled = enabled;
  }

  // 生命周期
  dispose(): void {
    this._edgeConfig?.onDestroy?.(this);
    this.m.counter("edge.disposed").add(1);
  }

  // 序列化
  toString(): string {
    const sourceIds = this.sourceIds.join(",");
    const targetIds = this.targetIds.join(",");
    return `DuckEdge(${sourceIds} -> ${targetIds}, valid: ${this._isValid}, state: ${this._state})`;
  }

  toJSON(): Record<string, unknown> {
    return {
      sources: this._sources.map((s) => ({
        nodeId: s.nodeId,
        port: s.port,
        portIndex: s.portIndex,
      })),
      targets: this._targets.map((t) => ({
        nodeId: t.nodeId,
        port: t.port,
        portIndex: t.portIndex,
      })),
      isValid: this._isValid,
      state: this._state,
      data: this._edgeData,
      config: this._edgeConfig,
    };
  }

  // 私有方法
  private _validateEdge(): void {
    const config = this._edgeConfig;

    // 检查是否允许自环
    if (this.isSelfLoop() && config?.allowSelfLoop === false) {
      this._isValid = false;
      this.m.counter("edge.invalid").add(1, { reason: "self_loop" });
      return;
    }

    // 检查端口连接是否合理（输出连输入）
    const hasInvalidPort =
      this._sources.some((s) => s.port === "input") ||
      this._targets.some((t) => t.port === "output");
    if (hasInvalidPort) {
      this._isValid = false;
      this.m.counter("edge.invalid").add(1, { reason: "invalid_port" });
      return;
    }

    // 运行自定义验证器（简化，假设验证所有源和目标）
    if (config?.validator) {
      const valid = this._sources.every((s) => this._targets.every((t) => config.validator!(s, t)));
      this._isValid = valid;
      this.m.counter("edge.validated").add(1, { custom: true, valid });
      return;
    }

    this._isValid = true;
    this.m.counter("edge.validated").add(1, { custom: false, valid: true });
  }
}
