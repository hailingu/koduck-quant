import { deity } from "./src/common/deity";

// 添加调试日志在主entry point被加载时
console.log("🏁 [DuckFlow] 浏览器加载开始");
console.log("🏛️ [DuckFlow] deity初始状态:", {
  instanceId: deity.toString(),
  registryManager: deity.RegistryManager.name,
  registryCount: deity.RegistryManager.getAllRegistryNames().length,
});

// 强制加载UML实体
console.log("🎯 [DuckFlow] 强制加载UML实体...");
import("./src/entities/uml-entities-new-decorator")
  .then(() => {
    console.log("✅ [DuckFlow] UML实体加载完成");
    console.log("📊 [DuckFlow] 最终注册表状态:", {
      registryCount: deity.RegistryManager.getAllRegistryNames().length,
      registries: deity.RegistryManager.getAllRegistryNames(),
    });

    // 测试创建实体
    console.log("🧪 [DuckFlow] 测试创建UML实体...");
    try {
      const entity = deity.EntityManager.createEntity("uml-usecase-canvas", {
        id: "test-entity",
        x: 100,
        y: 100,
        data: { label: "测试用例" },
      });
      console.log("✅ [DuckFlow] 实体创建成功:", entity?.id);
    } catch (error) {
      console.error("❌ [DuckFlow] 实体创建失败:", error);
    }
  })
  .catch((error) => {
    console.error("❌ [DuckFlow] UML实体加载失败:", error);
  });
