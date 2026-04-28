import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// 确保UML实体在应用启动时就被加载，避免竞态条件
import "./components/demo/FlowDemo/uml-entities-new-decorator";
import App from "./App.tsx";
import { logger } from "./common/logger";
import { DEFAULT_DUCKFLOW_ENVIRONMENT, getRuntimeForEnvironment } from "./common/global-runtime";

// 在应用启动时立即检查注册表状态
logger.info("🚀 应用启动 - 检查UML注册表状态");
const runtime = getRuntimeForEnvironment(DEFAULT_DUCKFLOW_ENVIRONMENT);
const registryManager = runtime.RegistryManager;
logger.info("🔗 main.tsx中的RegistryManager实例:", {
  instance: registryManager.constructor.name,
  instanceId: registryManager.toString(),
  totalRegistries: registryManager.getRegistryNames().length,
});

const allRegistries = registryManager.getRegistryNames();
logger.info("📋 已注册的注册表:", allRegistries);

const umlTypes = [
  "uml-class-canvas",
  "uml-interface-canvas",
  "uml-usecase-canvas",
  "uml-actor-canvas",
  "uml-line-canvas",
];

umlTypes.forEach((type) => {
  const hasRegistry = registryManager.hasRegistry(type);
  const registry = registryManager.getRegistry(type);
  logger.info(`🔍 ${type}: hasRegistry=${hasRegistry}, registry=${!!registry}`);

  if (!hasRegistry) {
    logger.error(`❌ 注册表缺失: ${type} - 这可能是时序问题或多实例问题`);
  }
});

const container = document.getElementById("root");

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  logger.error("Root container '#root' was not found. Skipping render bootstrap.");
}
