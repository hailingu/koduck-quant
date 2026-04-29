import type { IEntity } from "../../entity/types";
import type { IRenderContext } from "../context";

export interface ReactStrategyPluginOptions {
  /** Custom strategy ID. Default: `render/react-default` */
  id?: string;
  /** Priority, higher value means higher priority. Default: 100 */
  priority?: number;
  /** Strategy display name for debugging or UI presentation. */
  displayName?: string;
  /** Strategy version number. Default: `1.0.0` */
  version?: string;
  /** Custom tags for capability grouping. */
  tags?: string[];
  /** Required runtime capabilities. */
  requiredCapabilities?: string[];
  /** Optional runtime capabilities. */
  optionalCapabilities?: string[];
  /** Additional description. */
  description?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
  /** Custom predicate logic for strategy hit. By default: gives up if entity type ends with canvas. */
  predicate?: (entity: IEntity, context: IRenderContext) => boolean;
  /** Custom confidence for selection result. Default: 0.9 */
  confidence?: number;
}

export interface WebGPUStrategyPluginOptions {
  /** Custom strategy ID. Default: `render/webgpu-default` */
  id?: string;
  /** Priority, higher value means higher priority. Default: 120 */
  priority?: number;
  /** Strategy display name for debugging or UI presentation. */
  displayName?: string;
  /** Strategy version number. Default: `1.0.0` */
  version?: string;
  /** Custom tags for capability grouping. */
  tags?: string[];
  /** Required runtime capabilities. */
  requiredCapabilities?: string[];
  /** Optional runtime capabilities. */
  optionalCapabilities?: string[];
  /** Additional description. */
  description?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
  /** Custom predicate logic for strategy hit. By default: requires entity type to end with canvas. */
  predicate?: (entity: IEntity, context: IRenderContext) => boolean;
  /** Custom confidence for selection result. Default: 0.95 */
  confidence?: number;
  /** Whether the render context must contain Canvas. Default: true */
  requireCanvasContext?: boolean;
}

export interface SSRStrategyPluginOptions {
  /** Custom strategy ID. Default: `render/ssr-default` */
  id?: string;
  /** Priority, higher value means higher priority. Default: 110 */
  priority?: number;
  /** Strategy display name for debugging or UI presentation. */
  displayName?: string;
  /** Strategy version number. Default: `1.0.0` */
  version?: string;
  /** Custom tags for capability grouping. */
  tags?: string[];
  /** Required runtime capabilities. */
  requiredCapabilities?: string[];
  /** Optional runtime capabilities. */
  optionalCapabilities?: string[];
  /** Additional description. */
  description?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
  /** Custom predicate logic for strategy hit. */
  predicate?: (entity: IEntity, context: IRenderContext) => boolean;
  /** Custom confidence for selection result. Default: 0.92 */
  confidence?: number;
  /** Whether to require no browser globals (server environment). Default: true */
  requireServerEnvironment?: boolean;
}
