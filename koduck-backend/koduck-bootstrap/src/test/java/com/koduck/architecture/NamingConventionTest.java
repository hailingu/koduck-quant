package com.koduck.architecture;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;

/**
 * 命名规范规则测试。
 *
 * <p>验证代码命名规范：</p>
 * <ul>
 *   <li>Service 接口应以 Service 结尾</li>
 *   <li>DTO 应以 Dto 结尾</li>
 *   <li>Exception 应以 Exception 结尾</li>
 * </ul>
 *
 * @author Koduck Team
 */
class NamingConventionTest {

    /** 导入的类集合。 */
    private static JavaClasses importedClasses;

    @BeforeAll
    static void setUp() {
        importedClasses = new ClassFileImporter()
                .importPackages(ArchitectureConstants.BASE_PACKAGE);
    }

    @Test
    @DisplayName("API 包中的接口应以 Service 结尾")
    void serviceInterfacesShouldHaveServiceSuffix() {
        ArchRule rule = ArchRuleDefinition.classes()
                .that()
                .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                .and().areInterfaces()
                .should()
                .haveSimpleNameEndingWith("Service")
                .because("Service 接口命名应统一以 Service 结尾，便于识别和使用")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("DTO 应以 Dto 结尾")
    void dtoClassesShouldHaveDtoSuffix() {
        ArchRule rule = ArchRuleDefinition.classes()
                .that()
                .resideInAPackage("..dto..")
                .should()
                .haveSimpleNameEndingWith("Dto")
                .because("DTO 类命名应统一以 Dto 结尾，便于识别数据传输对象")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("Exception 应以 Exception 结尾")
    void exceptionClassesShouldHaveExceptionSuffix() {
        ArchRule rule = ArchRuleDefinition.classes()
                .that()
                .resideInAPackage("..exception..")
                .should()
                .haveSimpleNameEndingWith("Exception")
                .because("异常类命名应统一以 Exception 结尾，符合 Java 惯例")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }
}
