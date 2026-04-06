package com.koduck.common;

import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.TestPropertySource;

/**
 * Repository 切片测试基类。
 *
 * <p>提供 H2 内存数据库支持的 Repository 测试基础。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@DataJpaTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
})
public abstract class AbstractSliceTest {
    // Repository 切片测试基类
}
