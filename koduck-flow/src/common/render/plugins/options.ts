import type { IEntity } from "../../entity/types";
import type { IRenderContext } from "../context";

export interface ReactStrategyPluginOptions {
  /** 自定义策略 ID。默认值：`render/react-default` */
  id?: string;
  /** 优先级，数值越大越优先。默认值：100 */
  priority?: number;
  /** 策略显示名称，用于调试或 UI 呈现。 */
  displayName?: string;
  /** 策略版本号。默认值：`1.0.0` */
  version?: string;
  /** 自定义标签，用于能力分组。 */
  tags?: string[];
  /** 强制依赖的运行时能力。 */
  requiredCapabilities?: string[];
  /** 可选依赖的运行时能力。 */
  optionalCapabilities?: string[];
  /** 额外的描述信息。 */
  description?: string;
  /** 附加的元数据。 */
  metadata?: Record<string, unknown>;
  /** 自定义命中策略的判定逻辑。缺省情况下：如果实体类型以 `canvas` 结尾则放弃。 */
  predicate?: (entity: IEntity, context: IRenderContext) => boolean;
  /** 自定义选择结果的置信度。默认值：0.9 */
  confidence?: number;
}

export interface WebGPUStrategyPluginOptions {
  /** 自定义策略 ID。默认值：`render/webgpu-default` */
  id?: string;
  /** 优先级，数值越大越优先。默认值：120 */
  priority?: number;
  /** 策略显示名称，用于调试或 UI 呈现。 */
  displayName?: string;
  /** 策略版本号。默认值：`1.0.0` */
  version?: string;
  /** 自定义标签，用于能力分组。 */
  tags?: string[];
  /** 强制依赖的运行时能力。 */
  requiredCapabilities?: string[];
  /** 可选依赖的运行时能力。 */
  optionalCapabilities?: string[];
  /** 额外的描述信息。 */
  description?: string;
  /** 附加的元数据。 */
  metadata?: Record<string, unknown>;
  /** 自定义命中策略的判定逻辑。缺省情况下：要求实体类型以 `canvas` 结尾。 */
  predicate?: (entity: IEntity, context: IRenderContext) => boolean;
  /** 自定义选择结果的置信度。默认值：0.95 */
  confidence?: number;
  /** 是否要求渲染上下文必须包含 Canvas。默认值：true */
  requireCanvasContext?: boolean;
}

export interface SSRStrategyPluginOptions {
  /** 自定义策略 ID。默认值：`render/ssr-default` */
  id?: string;
  /** 优先级，数值越大越优先。默认值：110 */
  priority?: number;
  /** 策略显示名称，用于调试或 UI 呈现。 */
  displayName?: string;
  /** 策略版本号。默认值：`1.0.0` */
  version?: string;
  /** 自定义标签，用于能力分组。 */
  tags?: string[];
  /** 强制依赖的运行时能力。 */
  requiredCapabilities?: string[];
  /** 可选依赖的运行时能力。 */
  optionalCapabilities?: string[];
  /** 额外的描述信息。 */
  description?: string;
  /** 附加的元数据。 */
  metadata?: Record<string, unknown>;
  /** 自定义命中策略的判定逻辑。 */
  predicate?: (entity: IEntity, context: IRenderContext) => boolean;
  /** 自定义选择结果的置信度。默认值：0.92 */
  confidence?: number;
  /** 是否要求无浏览器全局（服务端环境）。默认值：true */
  requireServerEnvironment?: boolean;
}
