package com.koduck.common.event;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.koduck.common.AbstractUnitTest;

/**
 * DomainEvent 单元测试。
 *
 * @author Koduck Team
 * @since 0.1.0
 */
class DomainEventTest extends AbstractUnitTest {

    @Test
    @DisplayName("应自动生成事件ID")
    void shouldGenerateEventIdAutomatically() {
        // Given
        TestDomainEvent event = new TestDomainEvent();

        // Then
        assertThat(event.getEventId()).isNotNull();
        assertThat(event.getEventId()).isNotEmpty();
    }

    @Test
    @DisplayName("应自动记录发生时间")
    void shouldRecordOccurredOnAutomatically() {
        // Given
        TestDomainEvent event = new TestDomainEvent();

        // Then
        assertThat(event.getOccurredOn()).isNotNull();
    }

    @Test
    @DisplayName("应自动识别事件类型")
    void shouldIdentifyEventTypeAutomatically() {
        // Given
        TestDomainEvent event = new TestDomainEvent();

        // Then
        assertThat(event.getEventType()).isEqualTo("TestDomainEvent");
    }

    @Test
    @DisplayName("不同事件应有不同ID")
    void differentEventsShouldHaveDifferentIds() {
        // Given
        TestDomainEvent event1 = new TestDomainEvent();
        TestDomainEvent event2 = new TestDomainEvent();

        // Then
        assertThat(event1.getEventId()).isNotEqualTo(event2.getEventId());
    }

    @Test
    @DisplayName("toString 应包含关键信息")
    void toStringShouldContainKeyInfo() {
        // Given
        TestDomainEvent event = new TestDomainEvent();

        // When
        String str = event.toString();

        // Then
        assertThat(str).contains("TestDomainEvent");
        assertThat(str).contains(event.getEventId());
    }

    /**
     * 测试用领域事件。
     */
    private static class TestDomainEvent extends DomainEvent {
        // 测试用空实现
    }
}
