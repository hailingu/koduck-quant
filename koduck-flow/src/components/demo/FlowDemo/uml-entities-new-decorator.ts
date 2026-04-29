import type { IEntityArguments } from "../../../common/entity/types";
import type { ICapabilityAwareRegistry } from "../../../common/registry/types";
import { Entity } from "../../../common/entity/entity";
import { Data } from "../../../common/data";
import { AutoRegistry } from "../../../utils/decorator/auto-registry";
import { logger } from "../../../common/logger";
import {
  DEFAULT_KODUCKFLOW_ENVIRONMENT,
  getRuntimeForEnvironment,
} from "../../../common/global-runtime";
import { BaseNode } from "../../../common/flow/base-node";
import type { IFlowEdgeEntity, IFlowNodeEntity, IEdge, IEndpoint } from "../../../common/flow/types";

const runtime = getRuntimeForEnvironment(DEFAULT_KODUCKFLOW_ENVIRONMENT);
const umlRegistryManager = runtime.RegistryManager;

// Add detailed logs to track UML entity registration process
logger.info("🔧 UML装饰器文件被加载");
logger.info("🔗 KoduckFlowRuntime对象:", runtime);
logger.info("🔗 使用的注册表管理器:", {
  manager: umlRegistryManager?.constructor?.name || "undefined",
  type: "registry",
  instanceId: umlRegistryManager?.toString() || "undefined",
  currentRegistries: umlRegistryManager?.getAllRegistryNames?.()?.length || 0,
});

// Verify this is indeed the same instance
logger.info("🔍 验证实例一致性:", {
  globalRuntimeRegistryManager: runtime.RegistryManager.toString(),
  umlRegistryManager: umlRegistryManager.toString(),
  isSameInstance: runtime.RegistryManager === umlRegistryManager,
});

// ============================================================================
// UML type definitions
// ============================================================================

export type UMLNodeType =
  | "class"
  | "interface"
  | "abstract"
  | "actor"
  | "usecase"
  | "component"
  | "package"
  | "note"
  | "line";

export type UMLPortDirection = "in" | "out";
export type UMLPortSide = "left" | "right" | "top" | "bottom";

export type UMLPortDefinition = {
  name: string;
  direction: UMLPortDirection;
  side: UMLPortSide;
  /**
   * Relative offset (0 ~ 1) along the side where the port should be placed.
   * For vertical sides it is measured from top to bottom, for horizontal sides
   * from left to right. Defaults to 0.5 (center of the side).
   */
  offset?: number;
  /**
   * Visual radius in pixels when rendering the port indicator. Falls back to 6.
   */
  radius?: number;
  /**
   * Additional outward offset applied when computing the port anchor position.
   * Useful to keep the port slightly outside the node bounds.
   */
  gap?: number;
};

export type UMLPortInfo = {
  descriptor: UMLPortDefinition;
  x: number;
  y: number;
  radius: number;
};

export type UMLEntityData = {
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  fillColor?: string;
  borderColor?: string;
  textColor?: string;
  label?: string;
  umlType?: UMLNodeType;
  lineWidth?: number;
  sourceId?: string;
  targetId?: string;
  sourcePort?: string;
  targetPort?: string;
  sourcePortIndex?: number;
  targetPortIndex?: number;
  ports?: UMLPortDefinition[];
} & Data;

// ============================================================================
// Base UML entity class
// ============================================================================

export abstract class UMLEntity extends Entity<UMLEntityData> {
  protected constructor(args?: IEntityArguments) {
    super();

    // Create and initialize data object
    this.data = Object.assign(new Data(), {
      position: { x: 0, y: 0 },
      width: 120,
      height: 80,
      fillColor: "#f0f0f0",
      borderColor: "#333",
      textColor: "#000",
      label: "",
      umlType: "class" as UMLNodeType,
      lineWidth: 2,
      ports: [],
    }) as UMLEntityData;

    if (args && typeof args === "object") {
      const a = args as Record<string, unknown>;
      if (this.data) {
        this.data.position = {
          x: (a.x as number) ?? 0,
          y: (a.y as number) ?? 0,
        };
        this.data.width = (a.width as number) ?? 120;
        this.data.height = (a.height as number) ?? 80;
        this.data.fillColor = (a.fillColor as string) ?? "#f0f0f0";
        this.data.borderColor = (a.borderColor as string) ?? "#333";
        this.data.textColor = (a.textColor as string) ?? "#000";
        this.data.label = (a.label as string) ?? "";
        this.data.umlType = (a.umlType as UMLNodeType) ?? "class";
        this.data.lineWidth = (a.lineWidth as number) ?? 2;
      }
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      data: this.data?.toJSON ? this.data.toJSON() : this.data,
      config: this.config,
    };
  }

  /**
   * Check if can render
   */
  canRender(context?: unknown): boolean {
    return !!context && typeof context === "object";
  }

  /**
   * Render entity
   */
  async render(context?: unknown): Promise<void> {
    // Base Canvas drawing implementation
    const ctxObj = context as { canvas?: HTMLCanvasElement } | undefined;
    const canvas = ctxObj?.canvas;
    if (!canvas) return; // Skip if no canvas (may be a React render path placeholder)

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = this.data?.position?.x ?? 0;
    const y = this.data?.position?.y ?? 0;
    const width = this.data?.width ?? 120;
    const height = this.data?.height ?? 80;
    const fill = this.data?.fillColor ?? "#f0f0f0";
    const stroke = this.data?.borderColor ?? "#333";
    const textColor = this.data?.textColor ?? "#fff";
    const label = this.data?.label || this.constructor.name;

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = this.data?.lineWidth ?? 2;
    ctx.rect(x, y, width, height);
    ctx.fill();
    ctx.stroke();

    // header bar
    ctx.fillStyle = stroke;
    ctx.fillRect(x, y, width, 24);
    ctx.fillStyle = textColor;
    ctx.font = "14px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 8, y + 12);
    ctx.restore();
  }

  // ============================================================================
  // Execution capability implementation
  // ============================================================================

  /**
   * Check if can execute
   */
  canExecute(params?: unknown): boolean {
    return params !== undefined;
  }

  /**
   * Execute entity-specific operation
   */
  async execute(params?: unknown): Promise<unknown> {
    logger.debug(`Executing ${this.constructor.name} with params:`, params);
    return { success: true, result: `Executed ${this.label}` };
  }

  // ============================================================================
  // Validation capability implementation
  // ============================================================================

  /**
   * Check if can validate
   */
  canValidate(data?: unknown): boolean {
    return data !== undefined;
  }

  /**
   * Validate entity data
   */
  async validate(data?: unknown): Promise<boolean> {
    logger.debug(`Validating ${this.constructor.name} with data:`, data);
    return this.data !== undefined && this.label !== "";
  }

  // ============================================================================
  // Geometry and property methods
  // ============================================================================

  getBounds() {
    return {
      x: this.data?.position?.x ?? 0,
      y: this.data?.position?.y ?? 0,
      width: this.data?.width ?? 120,
      height: this.data?.height ?? 80,
    };
  }

  setPosition(x: number, y: number) {
    if (this.data) {
      this.data.position = { x, y };
    }
  }

  // Property accessors
  get x(): number {
    return this.data?.position?.x ?? 0;
  }

  set x(value: number) {
    if (this.data?.position) {
      this.data.position.x = value;
    }
  }

  get y(): number {
    return this.data?.position?.y ?? 0;
  }

  set y(value: number) {
    if (this.data?.position) {
      this.data.position.y = value;
    }
  }

  get width(): number {
    return this.data?.width ?? 120;
  }

  set width(value: number) {
    if (this.data) {
      this.data.width = value;
    }
  }

  get height(): number {
    return this.data?.height ?? 80;
  }

  set height(value: number) {
    if (this.data) {
      this.data.height = value;
    }
  }

  get label(): string {
    return this.data?.label ?? "";
  }

  set label(value: string) {
    if (this.data) {
      this.data.label = value;
    }
  }

  get umlType(): UMLNodeType {
    return this.data?.umlType ?? "class";
  }

  set umlType(value: UMLNodeType) {
    if (this.data) {
      this.data.umlType = value;
    }
  }
}

export abstract class UMLNodeEntity extends UMLEntity implements IFlowNodeEntity<BaseNode> {
  readonly node: BaseNode;
  protected ports: UMLPortDefinition[] = [];

  protected constructor(args?: IEntityArguments) {
    super(args);
    this.node = new BaseNode();
    if (this.data) {
      this.data.ports = [];
    }
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      node: this.node.toJSON(),
    };
  }

  protected setPorts(definitions: UMLPortDefinition[]): void {
    this.ports = definitions.map((definition) => ({
      radius: 6,
      offset: 0.5,
      gap: 0,
      ...definition,
    }));
    if (this.data) {
      this.data.ports = this.ports.map((definition) => ({ ...definition }));
    }
  }

  getPortDefinitions(): readonly UMLPortDefinition[] {
    return this.ports;
  }

  getAllPortInfo(): UMLPortInfo[] {
    return this.ports
      .map((definition) => this.computePortInfo(definition))
      .filter((info): info is UMLPortInfo => info !== null);
  }

  getPortInfo(name: string, index = 0): UMLPortInfo | null {
    let matchIndex = 0;
    for (const definition of this.ports) {
      if (definition.name !== name) continue;
      if (matchIndex === index) {
        return this.computePortInfo(definition);
      }
      matchIndex += 1;
    }
    return null;
  }

  protected computePortInfo(definition: UMLPortDefinition): UMLPortInfo | null {
    const baseX = this.data?.position?.x ?? 0;
    const baseY = this.data?.position?.y ?? 0;
    const width = this.data?.width ?? 0;
    const height = this.data?.height ?? 0;
    const offset = Math.min(Math.max(definition.offset ?? 0.5, 0), 1);
    const radius = definition.radius ?? 6;
    const gap = definition.gap ?? radius * 0.6;

    let x = baseX;
    let y = baseY;

    switch (definition.side) {
      case "left": {
        x = baseX - gap;
        y = baseY + height * offset;
        break;
      }
      case "right": {
        x = baseX + width + gap;
        y = baseY + height * offset;
        break;
      }
      case "top": {
        x = baseX + width * offset;
        y = baseY - gap;
        break;
      }
      case "bottom": {
        x = baseX + width * offset;
        y = baseY + height + gap;
        break;
      }
      default:
        return null;
    }

    return {
      descriptor: definition,
      x,
      y,
      radius,
    };
  }

  override dispose(): void {
    try {
      if (typeof this.node.dispose === "function") {
        this.node.dispose();
      }
    } finally {
      super.dispose();
    }
  }

  protected renderPorts(ctx: CanvasRenderingContext2D): void {
    if (!this.ports.length) return;

    for (const info of this.getAllPortInfo()) {
      const { descriptor, x, y, radius } = info;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = descriptor.direction === "out" ? "#2563eb" : "#0ea5e9";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

export abstract class UMLEdgeEntity<E extends IEdge = IEdge>
  extends UMLEntity
  implements IFlowEdgeEntity<E>
{
  readonly edge: E;

  protected constructor(args?: IEntityArguments) {
    super(args);
    this.edge = this.createEdge(args);
  }

  protected abstract createEdge(args?: IEntityArguments): E;

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      edge: this.edge.toJSON(),
    };
  }

  override dispose(): void {
    try {
      if (typeof this.edge.dispose === "function") {
        this.edge.dispose();
      }
    } finally {
      super.dispose();
    }
  }
}

// ============================================================================
// Concrete UML entity implementations (using new decorator system)
// ============================================================================

/**
 * UML class entity - using new capability-aware decorator system
 */
@AutoRegistry({
  registryManager: umlRegistryManager,
  autoRegister: true,
  registryName: "uml-class-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "UML Class entity with capability-aware registry",
    umlType: "class",
  },
})
export class UMLClassEntity extends UMLNodeEntity {
  static readonly type = "uml-class-canvas";

  constructor(args?: IEntityArguments) {
    super(args);
    this.umlType = "class";

    if (args && typeof args === "object") {
      const a = args as Record<string, unknown>;
      this.label = (a.label as string) || "Class";
    }
  }

  override async execute(params?: unknown): Promise<string> {
    await super.execute(params);
    logger.info("Executing class code generation for", this.label);
    return `public class ${this.label} {\n    // Generated class\n}`;
  }
}

/**
 * UML interface entity - using new capability-aware decorator system
 */
@AutoRegistry({
  registryManager: umlRegistryManager,
  autoRegister: true,
  registryName: "uml-interface-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "UML Interface entity with capability-aware registry",
    umlType: "interface",
  },
})
export class UMLInterfaceEntity extends UMLNodeEntity {
  static readonly type = "uml-interface-canvas";

  constructor(args?: IEntityArguments) {
    super(args);
    this.umlType = "interface";
    this.label = (args?.label as string) || "Interface";
  }

  override async execute(params?: unknown): Promise<string> {
    await super.execute(params);
    logger.info("Executing interface code generation for", this.label);
    return `public interface ${this.label} {\n    // Generated interface\n}`;
  }

  /**
   * Render: dashed border + stereotype
   */
  override async render(context?: unknown): Promise<void> {
    const ctxObj = context as { canvas?: HTMLCanvasElement } | undefined;
    const canvas = ctxObj?.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = this.data?.position?.x ?? 0;
    const y = this.data?.position?.y ?? 0;
    const width = this.data?.width ?? 140;
    const height = this.data?.height ?? 90;
    const fill = this.data?.fillColor ?? "#f7f7ff";
    const stroke = this.data?.borderColor ?? "#333";
    const textColor = this.data?.textColor ?? "#000";

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([6, 3]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.rect(x, y, width, height);
    ctx.fill();
    ctx.stroke();

    // stereotype + label
    ctx.setLineDash([]);
    ctx.fillStyle = textColor;
    ctx.font = "12px sans-serif";
    ctx.textBaseline = "top";
    const stereotype = "«interface»";
    ctx.fillText(stereotype, x + 8, y + 6);
    ctx.font = "14px sans-serif";
    ctx.fillText(this.label || "Interface", x + 8, y + 24);
    ctx.restore();
  }
}

/**
 * UML use case entity - using new capability-aware decorator system
 */
@AutoRegistry({
  registryManager: umlRegistryManager,
  autoRegister: true,
  registryName: "uml-usecase-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "UML UseCase entity with capability-aware registry",
    umlType: "usecase",
  },
})
export class UMLUseCaseEntity extends UMLNodeEntity {
  static readonly type = "uml-usecase-canvas";

  constructor(args?: IEntityArguments) {
    super(args);
    this.umlType = "usecase";
    this.label = (args?.label as string) || "Use Case";
    this.setPorts([
      {
        name: "in",
        direction: "in",
        side: "left",
        offset: 0.5,
        radius: 5,
        gap: 12,
      },
    ]);
  }

  override async execute(params?: unknown): Promise<string> {
    await super.execute(params);
    logger.info("Executing use case documentation generation for", this.label);
    return `Use Case: ${this.label}\nDescription: Generated use case documentation`;
  }

  /**
   * Render: ellipse use case
   */
  override async render(context?: unknown): Promise<void> {
    const ctxObj = context as { canvas?: HTMLCanvasElement } | undefined;
    const canvas = ctxObj?.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = this.data?.position?.x ?? 0;
    const y = this.data?.position?.y ?? 0;
    const width = this.data?.width ?? 140;
    const height = this.data?.height ?? 80;
    const fill = this.data?.fillColor ?? "#eef7ff";
    const stroke = this.data?.borderColor ?? "#333";
    const textColor = this.data?.textColor ?? "#000";

    const cx = x + width / 2;
    const cy = y + height / 2;
    const rx = width / 2;
    const ry = height / 2;

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center label
    ctx.fillStyle = textColor;
    ctx.font = "14px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(this.label || "Use Case", cx, cy);
    this.renderPorts(ctx);
    ctx.restore();
  }
}

/**
 * UML actor entity - using new capability-aware decorator system
 */
@AutoRegistry({
  registryManager: umlRegistryManager,
  autoRegister: true,
  registryName: "uml-actor-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "UML Actor entity with capability-aware registry",
    umlType: "actor",
  },
})
export class UMLActorEntity extends UMLNodeEntity {
  static readonly type = "uml-actor-canvas";

  constructor(args?: IEntityArguments) {
    super(args);
    this.umlType = "actor";
    this.label = (args?.label as string) || "Actor";
    this.setPorts([
      {
        name: "out",
        direction: "out",
        side: "right",
        offset: 0.45,
        radius: 5,
        gap: 12,
      },
    ]);
  }

  override async execute(params?: unknown): Promise<string> {
    await super.execute(params);
    logger.info("Executing actor analysis for", this.label);
    return `Actor Analysis: ${this.label}\nRole: System user\nResponsibilities: To be defined`;
  }

  /**
   * Render: simple stick figure
   */
  override async render(context?: unknown): Promise<void> {
    const ctxObj = context as { canvas?: HTMLCanvasElement } | undefined;
    const canvas = ctxObj?.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = this.data?.position?.x ?? 0;
    const y = this.data?.position?.y ?? 0;
    const width = this.data?.width ?? 80;
    const height = this.data?.height ?? 120;
    const stroke = this.data?.borderColor ?? "#333";
    const textColor = this.data?.textColor ?? "#000";

    // Calculate proportions
    const cx = x + width / 2;
    const headRadius = Math.min(width, height) * 0.15;
    const headCenterY = y + headRadius + 4;
    const bodyTopY = headCenterY + headRadius + 4;
    const bodyBottomY = y + height - 20;

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;

    // Head
    ctx.beginPath();
    ctx.arc(cx, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(cx, bodyTopY);
    ctx.lineTo(cx, (bodyTopY + bodyBottomY) / 2);
    ctx.stroke();

    // Arms
    const armY = bodyTopY + (bodyBottomY - bodyTopY) * 0.25;
    const armSpan = width * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx - armSpan, armY);
    ctx.lineTo(cx + armSpan, armY);
    ctx.stroke();

    // Legs
    const hipY = (bodyTopY + bodyBottomY) / 2;
    const legSpan = width * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx - legSpan, bodyBottomY);
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + legSpan, bodyBottomY);
    ctx.stroke();

    // Label (bottom center)
    ctx.fillStyle = textColor;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.label || "Actor", cx, y + height - 16);
    this.renderPorts(ctx);
    ctx.restore();
  }
}

/**
 * UML line entity - supports drawing a straight line on canvas
 */

type LineEndpointConfig = {
  nodeId: string;
  port?: string;
  portIndex?: number;
  state?: "active" | "inactive" | "disabled";
};

type BoundsProvider = {
  getBounds?: () => { x: number; y: number; width: number; height: number };
  data?: {
    position?: { x?: number; y?: number };
  };
};

class LineEndpoint implements IEndpoint {
  nodeId: string;
  port: string;
  state: "active" | "inactive" | "disabled";
  portIndex?: number;

  constructor(config: LineEndpointConfig) {
    this.nodeId = config.nodeId;
    this.port = config.port ?? "out";
    this.state = config.state ?? "active";
    if (config.portIndex !== undefined) {
      this.portIndex = config.portIndex;
    }
  }

  setState(state: "active" | "inactive" | "disabled") {
    this.state = state;
  }

  toJSON(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      nodeId: this.nodeId,
      port: this.port,
      state: this.state,
    };

    if (this.portIndex !== undefined) {
      payload.portIndex = this.portIndex;
    }

    return payload;
  }

  dispose(): void {
    this.state = "inactive";
  }
}

class LineEdge implements IEdge {
  readonly sources: IEndpoint[] = [];
  readonly targets: IEndpoint[] = [];
  private _state: "active" | "inactive" | "disabled" = "active";

  constructor(config?: {
    source?: LineEndpointConfig | null;
    target?: LineEndpointConfig | null;
    state?: "active" | "inactive" | "disabled";
  }) {
    if (config?.state) this._state = config.state;
    if (config?.source) this.setSource(config.source);
    if (config?.target) this.setTarget(config.target);
  }

  get isValid(): boolean {
    return this.sources.length > 0 && this.targets.length > 0;
  }

  get state(): "active" | "inactive" | "disabled" {
    return this._state;
  }

  setState(state: "active" | "inactive" | "disabled"): void {
    this._state = state;
    this.syncEndpointState();
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

  connectsNode(nodeId: string): boolean {
    return (
      this.sources.some((endpoint) => endpoint.nodeId === nodeId) ||
      this.targets.some((endpoint) => endpoint.nodeId === nodeId)
    );
  }

  connectsNodes(node1: string, node2: string): boolean {
    if (!this.isValid) return false;
    const nodeIds = new Set([...this.sources, ...this.targets].map((endpoint) => endpoint.nodeId));
    return nodeIds.has(node1) && nodeIds.has(node2);
  }

  getOtherNodes(nodeId: string): string[] {
    const otherNodes = new Set<string>();
    for (const endpoint of [...this.sources, ...this.targets]) {
      if (endpoint.nodeId !== nodeId) {
        otherNodes.add(endpoint.nodeId);
      }
    }
    return Array.from(otherNodes);
  }

  isSelfLoop(): boolean {
    if (!this.isValid) return false;
    return this.sources.some((source) =>
      this.targets.some((target) => target.nodeId === source.nodeId)
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      state: this._state,
      sources: this.sources.map((endpoint) => endpoint.toJSON()),
      targets: this.targets.map((endpoint) => endpoint.toJSON()),
    };
  }

  dispose(): void {
    this.sources.splice(0).forEach((endpoint) => endpoint.dispose());
    this.targets.splice(0).forEach((endpoint) => endpoint.dispose());
  }

  setSource(config: LineEndpointConfig | null): void {
    this.sources.splice(0);
    if (config) {
      const endpointConfig: LineEndpointConfig = { ...config };
      endpointConfig.state ??= this._state;
      this.sources.push(new LineEndpoint(endpointConfig));
    }
  }

  setTarget(config: LineEndpointConfig | null): void {
    this.targets.splice(0);
    if (config) {
      const endpointConfig: LineEndpointConfig = { ...config };
      endpointConfig.state ??= this._state;
      this.targets.push(new LineEndpoint(endpointConfig));
    }
  }

  private syncEndpointState(): void {
    for (const endpoint of [...this.sources, ...this.targets]) {
      if (endpoint instanceof LineEndpoint) {
        endpoint.setState(this._state);
      } else {
        endpoint.state = this._state;
      }
    }
  }
}

function isEdgeState(value: unknown): value is "active" | "inactive" | "disabled" {
  return value === "active" || value === "inactive" || value === "disabled";
}

@AutoRegistry({
  registryManager: umlRegistryManager,
  autoRegister: true,
  registryName: "uml-line-canvas",
  capabilities: ["render", "execute", "validate"],
  priority: 1,
  enableCapabilityDetection: true,
  meta: {
    description: "UML Line entity with capability-aware registry",
    umlType: "line",
  },
})
export class UMLLineEntity extends UMLEdgeEntity<LineEdge> {
  static readonly type = "uml-line-canvas";
  private readonly missingEndpointLogs = new Set<string>();

  constructor(args?: IEntityArguments) {
    super(args);
    this.umlType = "line";

    const a = (args ?? {}) as Record<string, unknown>;
    const startX = (a.x as number) ?? this.data?.position?.x ?? 100;
    const startY = (a.y as number) ?? this.data?.position?.y ?? 100;
    const endX = (a.x2 as number) ?? startX + ((a.width as number) ?? 160);
    const endY = (a.y2 as number) ?? startY + ((a.height as number) ?? 0);
    const initialSourceId = typeof a.sourceId === "string" ? (a.sourceId) : undefined;
    const initialTargetId = typeof a.targetId === "string" ? (a.targetId) : undefined;
    const initialSourcePort =
      typeof a.sourcePort === "string" ? (a.sourcePort) : undefined;
    const initialTargetPort =
      typeof a.targetPort === "string" ? a.targetPort : undefined;
    const initialSourcePortIndex =
      typeof a.sourcePortIndex === "number" ? a.sourcePortIndex : undefined;
    const initialTargetPortIndex =
      typeof a.targetPortIndex === "number" ? a.targetPortIndex : undefined;

    if (this.data) {
      this.data.position = { x: startX, y: startY };
      this.data.width = endX - startX;
      this.data.height = endY - startY;
      delete this.data.fillColor;
      this.data.borderColor = (a.borderColor as string) ?? "#222";
      this.data.lineWidth = (a.lineWidth as number) ?? this.data.lineWidth ?? 2;
      this.data.textColor = (a.textColor as string) ?? "#000";
    }

    this.label = (a.label as string) ?? "";

    const connectionPayload: {
      sourceId?: string | null;
      targetId?: string | null;
      sourcePort?: string;
      targetPort?: string;
      sourcePortIndex?: number;
      targetPortIndex?: number;
      state?: "active" | "inactive" | "disabled";
    } = {};

    if (initialSourceId !== undefined) {
      connectionPayload.sourceId = initialSourceId;
    }
    if (initialTargetId !== undefined) {
      connectionPayload.targetId = initialTargetId;
    }
    if (initialSourcePort !== undefined) {
      connectionPayload.sourcePort = initialSourcePort;
    }
    if (initialTargetPort !== undefined) {
      connectionPayload.targetPort = initialTargetPort;
    }
    if (initialSourcePortIndex !== undefined) {
      connectionPayload.sourcePortIndex = initialSourcePortIndex;
    }
    if (initialTargetPortIndex !== undefined) {
      connectionPayload.targetPortIndex = initialTargetPortIndex;
    }

    const edgeState = isEdgeState(a.edgeState)
      ? (a.edgeState)
      : undefined;
    if (edgeState !== undefined) {
      connectionPayload.state = edgeState;
    }

    this.setConnection(connectionPayload);
  }

  private logMissingEndpoint(endpoint: IEndpoint, reason: string): void {
    const key = `${endpoint.nodeId}:${endpoint.port ?? "?"}:${reason}`;
    if (this.missingEndpointLogs.has(key)) return;
    this.missingEndpointLogs.add(key);
    logger.debug(
      `[UMLLineEntity] missing endpoint detail (${reason}) -> node=${
        endpoint.nodeId
      }, port=${endpoint.port ?? "?"}`
    );
  }

  private setDataField<K extends keyof UMLEntityData>(
    key: K,
    value: UMLEntityData[K] | undefined
  ): void {
    if (!this.data) return;
    if (value === undefined) {
      delete (this.data as Record<string, unknown>)[key as string];
      return;
    }
    this.data[key] = value;
  }

  private buildEndpointConfig(
    nodeId: string,
    port?: string,
    portIndex?: number
  ): LineEndpointConfig {
    const endpoint: LineEndpointConfig = { nodeId };
    if (port !== undefined) {
      endpoint.port = port;
    }
    if (portIndex !== undefined) {
      endpoint.portIndex = portIndex;
    }
    return endpoint;
  }

  private resolveEndpointPosition(
    endpoint: IEndpoint | undefined
  ): { x: number; y: number } | null {
    if (!endpoint) return null;
    const entity = runtime.EntityManager.getEntity(endpoint.nodeId);
    if (!entity) {
      this.logMissingEndpoint(endpoint, "entity-not-found");
      return null;
    }

    if (endpoint.port && entity instanceof UMLNodeEntity) {
      const portInfo = entity.getPortInfo(endpoint.port, endpoint.portIndex ?? 0);
      if (portInfo) {
        return { x: portInfo.x, y: portInfo.y };
      }
      this.logMissingEndpoint(endpoint, "port-not-found");
    }

    const boundsEntity = entity as BoundsProvider;
    const bounds = boundsEntity.getBounds?.();
    if (bounds) {
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
    }

    const fallbackX = boundsEntity.data?.position?.x ?? 0;
    const fallbackY = boundsEntity.data?.position?.y ?? 0;
    return { x: fallbackX, y: fallbackY };
  }

  private computeRenderEndpoints(): {
    start: { x: number; y: number };
    end: { x: number; y: number };
    sourceResolved: boolean;
    targetResolved: boolean;
  } {
    const fallbackStart = {
      x: this.data?.position?.x ?? 0,
      y: this.data?.position?.y ?? 0,
    };
    const fallbackEnd = {
      x: fallbackStart.x + (this.data?.width ?? 0),
      y: fallbackStart.y + (this.data?.height ?? 0),
    };

    let start = fallbackStart;
    let end = fallbackEnd;
    let sourceResolved = false;
    let targetResolved = false;

    const sourceEndpoint = this.edge.sources[0] as IEndpoint | undefined;
    const targetEndpoint = this.edge.targets[0] as IEndpoint | undefined;

    const resolvedSource = this.resolveEndpointPosition(sourceEndpoint);
    if (resolvedSource) {
      start = resolvedSource;
      sourceResolved = true;
    }

    const resolvedTarget = this.resolveEndpointPosition(targetEndpoint);
    if (resolvedTarget) {
      end = resolvedTarget;
      targetResolved = true;
    }

    if (sourceResolved && targetResolved && this.data) {
      if (!this.data.position) { this.data.position = { x: start.x, y: start.y }; } else {
        this.data.position.x = start.x;
        this.data.position.y = start.y;
      }
      this.data.width = end.x - start.x;
      this.data.height = end.y - start.y;
    }

    return { start, end, sourceResolved, targetResolved };
  }

  protected override createEdge(args?: IEntityArguments): LineEdge {
    const a = (args ?? {}) as Record<string, unknown>;
    const sourceId = typeof a.sourceId === "string" ? (a.sourceId) : undefined;
    const targetId = typeof a.targetId === "string" ? (a.targetId) : undefined;
    const sourcePort = typeof a.sourcePort === "string" ? (a.sourcePort) : undefined;
    const targetPort = typeof a.targetPort === "string" ? (a.targetPort) : undefined;
    const sourcePortIndex =
      typeof a.sourcePortIndex === "number" ? (a.sourcePortIndex) : undefined;
    const targetPortIndex =
      typeof a.targetPortIndex === "number" ? a.targetPortIndex : undefined;

    const sourceConfig = sourceId
      ? this.buildEndpointConfig(sourceId, sourcePort, sourcePortIndex)
      : null;
    const targetConfig = targetId
      ? this.buildEndpointConfig(targetId, targetPort, targetPortIndex)
      : null;

    const edgeConfig: {
      source?: LineEndpointConfig | null;
      target?: LineEndpointConfig | null;
      state?: "active" | "inactive" | "disabled";
    } = {
      source: sourceConfig,
      target: targetConfig,
    };

    const edgeState = isEdgeState(a.edgeState)
      ? (a.edgeState)
      : undefined;
    if (edgeState !== undefined) {
      edgeConfig.state = edgeState;
    }

    return new LineEdge(edgeConfig);
  }

  override async render(context?: unknown): Promise<void> {
    const ctxObj = context as { canvas?: HTMLCanvasElement } | undefined;
    const canvas = ctxObj?.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { start, end } = this.computeRenderEndpoints();
    const startX = start.x;
    const startY = start.y;
    const endX = end.x;
    const endY = end.y;
    const stroke = this.data?.borderColor ?? "#222";
    const lineWidth = this.data?.lineWidth ?? 2;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    if (this.label) {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      ctx.font = "12px sans-serif";
      ctx.fillStyle = this.data?.textColor ?? stroke;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(this.label, midX, midY - 6);
    }

    ctx.restore();
  }

  override getBounds() {
    const { start, end } = this.computeRenderEndpoints();
    const lineWidth = this.data?.lineWidth ?? 2;
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const absWidth = Math.abs(end.x - start.x);
    const absHeight = Math.abs(end.y - start.y);
    const pad = Math.max(lineWidth / 2, 1);

    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(absWidth, lineWidth) + pad * 2,
      height: Math.max(absHeight, lineWidth) + pad * 2,
    };
  }

  setLineEnd(x: number, y: number) {
    if (!this.data) return;
    const startX = this.data.position?.x ?? 0;
    const startY = this.data.position?.y ?? 0;
    this.data.width = x - startX;
    this.data.height = y - startY;
  }

  setConnection(config: {
    sourceId?: string | null;
    targetId?: string | null;
    sourcePort?: string;
    targetPort?: string;
    sourcePortIndex?: number;
    targetPortIndex?: number;
    state?: "active" | "inactive" | "disabled";
  }): void {
    const nextSourceId =
      config.sourceId === undefined ? this.data?.sourceId : (config.sourceId ?? undefined);
    const nextTargetId =
      config.targetId === undefined ? this.data?.targetId : (config.targetId ?? undefined);

    const nextSourcePort =
      config.sourcePort ?? this.data?.sourcePort ;
    const nextTargetPort =
      config.targetPort ?? this.data?.targetPort ;

    const nextSourcePortIndex =
      config.sourcePortIndex ?? this.data?.sourcePortIndex ;
    const nextTargetPortIndex =
      config.targetPortIndex ?? this.data?.targetPortIndex ;

    this.setDataField("sourceId", nextSourceId);
    this.setDataField("targetId", nextTargetId);
    this.setDataField("sourcePort", nextSourcePort);
    this.setDataField("targetPort", nextTargetPort);
    this.setDataField("sourcePortIndex", nextSourcePortIndex);
    this.setDataField("targetPortIndex", nextTargetPortIndex);

    const nextSourceConfig =
      nextSourceId !== undefined
        ? this.buildEndpointConfig(nextSourceId, nextSourcePort, nextSourcePortIndex)
        : null;
    const nextTargetConfig =
      nextTargetId !== undefined
        ? this.buildEndpointConfig(nextTargetId, nextTargetPort, nextTargetPortIndex)
        : null;

    this.edge.setSource(nextSourceConfig);
    this.edge.setTarget(nextTargetConfig);

    if (config.state && isEdgeState(config.state)) {
      this.edge.setState(config.state);
    }
  }

  getConnection(): {
    sourceId: string | null;
    targetId: string | null;
    sourcePort?: string;
    targetPort?: string;
    sourcePortIndex?: number;
    targetPortIndex?: number;
    state?: "active" | "inactive" | "disabled";
  } {
    const sourceEndpoint = this.edge.sources[0] as IEndpoint | undefined;
    const targetEndpoint = this.edge.targets[0] as IEndpoint | undefined;

    const result: {
      sourceId: string | null;
      targetId: string | null;
      sourcePort?: string;
      targetPort?: string;
      sourcePortIndex?: number;
      targetPortIndex?: number;
      state?: "active" | "inactive" | "disabled";
    } = {
      sourceId: sourceEndpoint?.nodeId ?? this.data?.sourceId ?? null,
      targetId: targetEndpoint?.nodeId ?? this.data?.targetId ?? null,
    };

    const resolvedSourcePort =
      sourceEndpoint?.port ??
      (this.data ? this.data.sourcePort : undefined);
    if (resolvedSourcePort !== undefined) {
      result.sourcePort = resolvedSourcePort;
    }

    const resolvedTargetPort =
      targetEndpoint?.port ??
      (this.data ? this.data.targetPort : undefined);
    if (resolvedTargetPort !== undefined) {
      result.targetPort = resolvedTargetPort;
    }

    const resolvedSourcePortIndex =
      sourceEndpoint?.portIndex ??
      (this.data ? this.data.sourcePortIndex : undefined);
    if (resolvedSourcePortIndex !== undefined) {
      result.sourcePortIndex = resolvedSourcePortIndex;
    }

    const resolvedTargetPortIndex =
      targetEndpoint?.portIndex ??
      (this.data ? this.data.targetPortIndex : undefined);
    if (resolvedTargetPortIndex !== undefined) {
      result.targetPortIndex = resolvedTargetPortIndex;
    }

    const edgeState = this.edge.state;
    if (edgeState !== undefined) {
      result.state = edgeState;
    }

    return result;
  }
}

/**
 * Get info for all registered UML entities
 */
export function getUMLEntityRegistryInfo() {
  const registryManager = umlRegistryManager;

  const entityTypes = [
    "uml-class-canvas",
    "uml-interface-canvas",
    "uml-usecase-canvas",
    "uml-actor-canvas",
    "uml-line-canvas",
  ];

  return entityTypes.map((type) => {
    const registry = registryManager.getRegistry(type) as ICapabilityAwareRegistry<UMLEntity>;
    return {
      type,
      registered: !!registry,
      capabilities: registry?.getCapabilities() || [],
      meta: registry?.meta,
    };
  });
}
