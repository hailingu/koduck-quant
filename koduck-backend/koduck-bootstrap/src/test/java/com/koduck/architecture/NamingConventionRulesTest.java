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
 * <p>验证代码命名符合规范：</p>
 * <ul>
 *   <li>API 接口应以 Service 结尾</li>
 *   <li>Impl 类应以 Impl 结尾</li>
 *   <li>Repository 接口应以 Repository 结尾</li>
 *   <li>Controller 类应以 Controller 结尾</li>
 *   <li>DTO 类应以 Dto 结尾</li>
 * </ul>
 *
 * @author Koduck Team
 */
class NamingConventionRulesTest {

    /** 导入的类集合。 */
    private static JavaClasses importedClasses;

    @BeforeAll
    static void setUp() {
        importedClasses = new ClassFileImporter()
                .importPackages(ArchitectureConstants.BASE_PACKAGE);
    }

    @Test
    @DisplayName("API 接口应以 Service 结尾")
    void apiInterfacesShouldEndWithService() {
        ArchRule rule = ArchRuleDefinition.classes()
                .that()
                .resideInAPackage(ArchitectureConstants.API_PACKAGE)
                .and()
                .areInterfaces()
                .should()
                .haveSimpleNameEndingWith("Service")
                .because("API 模块的服务接口应以 Service 结尾，"
                        + "以明确其作为服务契约的角色")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("Impl 类应以 Impl 结尾")
    void implClassesShouldEndWithImpl() {
        ArchRule rule = ArchRuleDefinition.classes()
                .that()
                .resideInAPackage(ArchitectureConstants.IMPL_PACKAGE)
                .and()
                .areNotInterfaces()
                .and()
                .haveSimpleNameNotContaining("Test")
                .should()
                .haveSimpleNameEndingWith("Impl")
                .orShould()
                .haveSimpleNameEndingWith("Configuration")
                .orShould()
                .haveSimpleNameEndingWith("Properties")
                .because("实现类应以 Impl 结尾，配置类应以 Configuration 或 Properties 结尾，"
                        + "以明确其角色")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("Repository 接口应以 Repository 结尾")
    void repositoryInterfacesShouldEndWithRepository() {
        ArchRule rule = ArchRuleDefinition.classes()
                .that()
                .resideInAPackage("..repository..")
                .and()
                .areInterfaces()
                .should()
                .haveSimpleNameEndingWith("Repository")
                .because("Repository 接口应以 Repository 结尾，"
                        + "以符合 Spring Data JPA 的命名约定")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("Controller 类应以 Controller 结尾")
    void controllerClassesShouldEndWithController() {
        ArchRule rule = ArchRuleDefinition.classes()
                .that()
                .resideInAPackage("..controller..")
                .and()
                .areNotInterfaces()
                .should()
                .haveSimpleNameEndingWith("Controller")
                .because("Controller 类应以 Controller 结尾，"
                        + "以明确其作为 REST API 控制器的角色")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }

    @Test
    @DisplayName("DTO 类应以 Dto 结尾")
    void dtoClassesShouldEndWithDto() {
        ArchRule rule = ArchRuleDefinition.classes()
                .that()
                .resideInAPackage("..dto..")
                .and()
                .areNotInterfaces()
                .and()
                .haveSimpleNameNotContaining("Test")
                .should()
                .haveSimpleNameEndingWith("Dto")
                .orShould()
                .haveSimpleNameEndingWith("Request")
                .orShould()
                .haveSimpleNameEndingWith("Response")
                .because("DTO 类应以 Dto、Request 或 Response 结尾，"
                        + "以明确其作为数据传输对象的角色")
                .allowEmptyShould(true);

        rule.check(importedClasses);
    }
}
