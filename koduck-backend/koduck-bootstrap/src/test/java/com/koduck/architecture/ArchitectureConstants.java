package com.koduck.architecture;

/**
 * 架构测试常量定义。
 *
 * <p>定义包结构常量，用于 ArchUnit 规则。</p>
 *
 * @author Koduck Team
 */
public final class ArchitectureConstants {

    private ArchitectureConstants() {
        // Utility class
    }

    /** 基础包名。 */
    public static final String BASE_PACKAGE = "com.koduck";

    /** API 模块包名模式。 */
    public static final String API_PACKAGE = "..api..";

    /** 实现模块包名模式。 */
    public static final String IMPL_PACKAGE = "..impl..";

    /** 基础设施模块包名。 */
    public static final String INFRASTRUCTURE_PACKAGE = "com.koduck.infrastructure..";

    /** 公共模块包名。 */
    public static final String COMMON_PACKAGE = "com.koduck.common..";

    /** Core 模块包名。 */
    public static final String CORE_PACKAGE = "com.koduck.core..";

    /** Market 模块包名。 */
    public static final String MARKET_PACKAGE = "com.koduck.market..";

    /** Portfolio 模块包名。 */
    public static final String PORTFOLIO_PACKAGE = "com.koduck.portfolio..";

    /** Strategy 模块包名。 */
    public static final String STRATEGY_PACKAGE = "com.koduck.strategy..";

    /** Community 模块包名。 */
    public static final String COMMUNITY_PACKAGE = "com.koduck.community..";

    /** Auth 模块包名。 */
    public static final String AUTH_PACKAGE = "com.koduck.auth..";

    /** Spring Web 包名。 */
    public static final String SPRING_WEB_PACKAGE = "org.springframework.web..";

    /** Spring Data 包名。 */
    public static final String SPRING_DATA_PACKAGE = "org.springframework.data..";

    /** 模块切片模式。 */
    public static final String MODULE_SLICE_PATTERN = "com.koduck.(*)..";
}
