package com.koduck.architecture;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;

/**
 * 循环依赖规则测试。
 *
 * <p>验证模块间和包间不存在循环依赖：</p>
 * <ul>
 *   <li>模块间不应有循环依赖</li>
 *   <li>包间不应有循环依赖</li>
 * </ul>
 *
 * @author Koduck Team
 */
class CircularDependencyRulesTest {

    /** 导入的类集合。 */
    private static JavaClasses importedClasses;

    @BeforeAll
    static void setUp() {
        importedClasses = new ClassFileImporter()
                .importPackages(ArchitectureConstants.BASE_PACKAGE);
    }

    @Test
    @DisplayName("模块间不应有循环依赖")
    void modulesShouldBeFreeOfCycles() {
        ArchRule rule = SlicesRuleDefinition.slices()
                .matching(ArchitectureConstants.MODULE_SLICE_PATTERN)
                .should().beFreeOfCycles()
                .because("模块间的循环依赖会导致构建困难、测试复杂和代码耦合度高，"
                        + "应通过依赖注入和接口解耦")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("Domain 模块间不应有循环依赖")
    void domainModulesShouldBeFreeOfCycles() {
        String[] domainPackages = {
                "com.koduck.market",
                "com.koduck.portfolio",
                "com.koduck.strategy",
                "com.koduck.community",
                "com.koduck.ai"
        };

        for (String packageName : domainPackages) {
            ArchRule rule = SlicesRuleDefinition.slices()
                    .matching(packageName + ".(*)..")
                    .should().beFreeOfCycles()
                    .because("Domain 模块内部的包不应有循环依赖")
                    .allowEmptyShould(true);

            rule.check(importedClasses);
        }
    }
}
