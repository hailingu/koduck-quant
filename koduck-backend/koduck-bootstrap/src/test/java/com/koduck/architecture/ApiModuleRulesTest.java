package com.koduck.architecture;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;

/**
 * API 模块架构规则测试。
 *
 * <p>验证 API 模块的依赖约束：</p>
 * <ul>
 *   <li>API 模块不应依赖实现模块</li>
 *   <li>API 模块不应依赖 Spring Web</li>
 *   <li>API 模块不应依赖 Spring Data</li>
 * </ul>
 *
 * @author Koduck Team
 */
class ApiModuleRulesTest {

    /** 导入的类集合。 */
    private static JavaClasses importedClasses;

    @BeforeAll
    static void setUp() {
        // 导入所有 koduck 包下的类
        importedClasses = new ClassFileImporter()
                .importPackages(ArchitectureConstants.BASE_PACKAGE);
    }

    @Test
    @DisplayName("API 模块不应依赖实现模块")
    void apiModulesShouldNotDependOnImplModules() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAPackage(ArchitectureConstants.IMPL_PACKAGE)
                .because("API 模块只应包含接口和 DTO，不应依赖实现模块，"
                        + "以确保接口与实现分离，避免循环依赖")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("API 模块不应依赖 Spring Web")
    void apiModulesShouldNotDependOnSpringWeb() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAPackage(ArchitectureConstants.SPRING_WEB_PACKAGE)
                .because("API 模块应保持技术无关性，不应依赖 Spring Web，"
                        + "Web 层相关逻辑应在实现模块中处理")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("API 模块不应依赖 Spring Data")
    void apiModulesShouldNotDependOnSpringData() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAPackage(ArchitectureConstants.SPRING_DATA_PACKAGE)
                .because("API 模块不应依赖数据访问技术，Repository 接口定义"
                        + "应在实现模块或基础设施模块中")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }
}
