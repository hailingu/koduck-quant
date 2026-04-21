package com.koduck.architecture;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;

/**
 * 包依赖规则测试。
 *
 * <p>验证模块间的依赖方向是否正确：</p>
 * <ul>
 *   <li>API 模块不应依赖 Impl 模块</li>
 *   <li>Impl 模块可以依赖 API 模块</li>
 *   <li>Domain 模块间不应循环依赖</li>
 * </ul>
 *
 * @author Koduck Team
 */
class PackageDependencyRulesTest {

    /** 导入的类集合。 */
    private static JavaClasses importedClasses;

    @BeforeAll
    static void setUp() {
        importedClasses = new ClassFileImporter()
                .importPackages(ArchitectureConstants.BASE_PACKAGE);
    }

    @Test
    @DisplayName("API 模块不应依赖 Impl 模块")
    void apiModulesShouldNotDependOnImplModules() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAPackage(ArchitectureConstants.IMPL_PACKAGE)
                .because("API 模块作为领域契约层，不应依赖实现模块，"
                        + "以保持接口与实现的分离")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("API 模块不应依赖 Core 模块")
    void apiModulesShouldNotDependOnCoreModule() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                .should()
                .dependOnClassesThat()
                .resideInAPackage(ArchitectureConstants.CORE_PACKAGE)
                .because("API 模块作为领域契约层，不应依赖 Core 模块，"
                        + "以避免循环依赖和保持模块独立性")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("Domain 模块不应直接依赖其他 Domain 模块的 Impl")
    void domainModulesShouldNotDependOnOtherDomainImpl() {
        String[] domainPackages = {
                ArchitectureConstants.MARKET_PACKAGE,
                ArchitectureConstants.PORTFOLIO_PACKAGE,
                ArchitectureConstants.STRATEGY_PACKAGE,
                ArchitectureConstants.COMMUNITY_PACKAGE
        };

        for (String domainPackage : domainPackages) {
            ArchRule rule = ArchRuleDefinition.noClasses()
                    .that()
                    .resideInAPackage(domainPackage)
                    .and()
                    .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage(
                            ArchitectureConstants.PORTFOLIO_PACKAGE.replace("..", ".impl.."),
                            ArchitectureConstants.STRATEGY_PACKAGE.replace("..", ".impl.."),
                            ArchitectureConstants.COMMUNITY_PACKAGE.replace("..", ".impl..")
                    )
                    .because("Domain 模块的 API 不应依赖其他 Domain 模块的实现，"
                            + "模块间通信应通过 API 接口")
                    .allowEmptyShould(true);

            rule.check(importedClasses);
        }
    }
}
