package com.koduck.architecture;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;

/**
 * 分层架构规则测试。
 *
 * <p>验证分层架构的依赖方向：</p>
 * <pre>
 * bootstrap
 *     ↑
 * application (optional)
 *     ↑
 * domain modules (api)
 *     ↑
 * infrastructure
 *     ↑
 * common
 * </pre>
 *
 * @author Koduck Team
 */
class LayeredArchitectureTest {

    /** 导入的类集合。 */
    private static JavaClasses importedClasses;

    @BeforeAll
    static void setUp() {
        importedClasses = new ClassFileImporter()
                .importPackages(ArchitectureConstants.BASE_PACKAGE);
    }

    @Test
    @DisplayName("Common 模块不应依赖其他模块")
    void commonModuleShouldNotDependOnOtherModules() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.COMMON_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage(
                        ArchitectureConstants.CORE_PACKAGE,
                        ArchitectureConstants.MARKET_PACKAGE,
                        ArchitectureConstants.PORTFOLIO_PACKAGE,
                        ArchitectureConstants.STRATEGY_PACKAGE,
                        ArchitectureConstants.COMMUNITY_PACKAGE,
                        ArchitectureConstants.INFRASTRUCTURE_PACKAGE
                )
                .because("Common 模块作为最底层，不应依赖任何其他模块，"
                        + "以确保工具类可以被所有模块使用")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("API 模块不应依赖 Infrastructure 模块")
    void apiModuleShouldNotDependOnInfrastructure() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAPackage(ArchitectureConstants.INFRASTRUCTURE_PACKAGE)
                .because("API 模块作为领域契约层，不应依赖基础设施实现，"
                        + "以保持技术无关性")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }
}
