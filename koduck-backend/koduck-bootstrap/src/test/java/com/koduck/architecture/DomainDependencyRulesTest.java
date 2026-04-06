package com.koduck.architecture;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;

/**
 * 领域模块依赖规则测试。
 *
 * <p>验证领域模块间的依赖约束：</p>
 * <ul>
 *   <li>领域模块间不应有循环依赖</li>
 *   <li>koduck-core 不应依赖其他领域模块的实现</li>
 * </ul>
 *
 * @author Koduck Team
 */
class DomainDependencyRulesTest {

    /** 导入的类集合。 */
    private static JavaClasses importedClasses;

    @BeforeAll
    static void setUp() {
        importedClasses = new ClassFileImporter()
                .importPackages(ArchitectureConstants.BASE_PACKAGE);
    }

    @Test
    @DisplayName("领域模块间不应有循环依赖")
    void domainModulesShouldBeFreeOfCycles() {
        // 注意：此测试需要确保模块中有类存在
        // 如果模块为空，测试会被跳过
        ArchRule rule = SlicesRuleDefinition.slices()
                .matching(ArchitectureConstants.MODULE_SLICE_PATTERN)
                .should()
                .beFreeOfCycles()
                .because("领域模块间存在循环依赖会导致模块边界模糊，"
                        + "增加维护难度，应通过 ACL 或事件机制解耦");

        // 只有当导入的类数量足够时才执行检查
        if (importedClasses.size() > 10) {
            rule.check(importedClasses);
        }
    }

    @Test
    @DisplayName("koduck-core 不应依赖 market 实现模块")
    void coreShouldNotDependOnMarketImpl() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.CORE_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAPackage("com.koduck.market.impl..")
                .because("koduck-core 作为业务聚合层，不应直接依赖各领域的实现，"
                        + "应通过 API 模块定义的接口访问")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("koduck-core 不应依赖 portfolio 实现模块")
    void coreShouldNotDependOnPortfolioImpl() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.CORE_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAPackage("com.koduck.portfolio.impl..")
                .because("koduck-core 作为业务聚合层，不应直接依赖各领域的实现，"
                        + "应通过 API 模块定义的接口访问")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }
}
