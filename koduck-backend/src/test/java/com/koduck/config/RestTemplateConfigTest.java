package com.koduck.config;

import java.lang.reflect.Field;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import com.koduck.config.properties.DataServiceProperties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link RestTemplateConfig}.
 *
 * @author Koduck Team
 */
class RestTemplateConfigTest {

    /** Connect timeout in milliseconds for testing. */
    private static final int CONNECT_TIMEOUT_MS = 1500;

    /** Read timeout in milliseconds for testing. */
    private static final int READ_TIMEOUT_MS = 4500;

    /**
     * Verifies that the RestTemplate produced by the configuration uses a
     * buffering request factory and honors timeouts from properties.
     */
    @Test
    @DisplayName("shouldConfigureBufferingRequestFactoryAndTimeouts")
    void shouldConfigureBufferingRequestFactoryAndTimeouts() {
        RestTemplateConfig config = new RestTemplateConfig();
        RestTemplateBuilder builder = new RestTemplateBuilder();

        DataServiceProperties properties = new DataServiceProperties();
        properties.setConnectTimeoutMs(CONNECT_TIMEOUT_MS);
        properties.setReadTimeoutMs(READ_TIMEOUT_MS);

        RestTemplate restTemplate = config.dataServiceRestTemplate(builder, properties);

        ClientHttpRequestFactory requestFactory = restTemplate.getRequestFactory();
        assertThat(requestFactory).isInstanceOf(BufferingClientHttpRequestFactory.class);

        Object delegate = getFieldValue(requestFactory, "requestFactory");
        assertThat(delegate).isInstanceOf(SimpleClientHttpRequestFactory.class);

        assertThat(getIntFieldValue(delegate, "connectTimeout")).isEqualTo(CONNECT_TIMEOUT_MS);
        assertThat(getIntFieldValue(delegate, "readTimeout")).isEqualTo(READ_TIMEOUT_MS);
    }

    /**
     * Ensures that passing null for the builder or properties results in a
     * NullPointerException with an explanatory message.
     */
    @Test
    @DisplayName("shouldThrowNullPointerExceptionWhenBuilderOrPropertiesIsNull")
    void shouldThrowNullPointerExceptionWhenBuilderOrPropertiesIsNull() {
        RestTemplateConfig config = new RestTemplateConfig();
        DataServiceProperties properties = new DataServiceProperties();
        RestTemplateBuilder builder = new RestTemplateBuilder();

        assertThatThrownBy(() -> config.dataServiceRestTemplate(null, properties))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("builder must not be null");

        assertThatThrownBy(() -> config.dataServiceRestTemplate(builder, null))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("properties must not be null");
    }

    /**
     * Get field value using reflection.
     *
     * @param target the target object
     * @param fieldName the field name
     * @return the field value
     */
    private Object getFieldValue(Object target, String fieldName) {
        Class<?> current = target.getClass();
        while (current != null) {
            try {
                Field field = current.getDeclaredField(fieldName);
                field.setAccessible(true);
                return field.get(target);
            }
            catch (NoSuchFieldException e) {
                current = current.getSuperclass();
            }
            catch (IllegalAccessException ex) {
                throw new IllegalStateException("Failed to read field: " + fieldName, ex);
            }
        }
        throw new IllegalStateException("Field not found: " + fieldName);
    }

    /**
     * Get integer field value.
     *
     * @param target the target object
     * @param fieldName the field name
     * @return the integer value
     */
    private int getIntFieldValue(Object target, String fieldName) {
        Object value = getFieldValue(target, fieldName);
        assertThat(value).isInstanceOf(Integer.class);
        return (Integer) value;
    }
}
