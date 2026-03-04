package com.koduck.config;

import com.koduck.config.properties.DataServiceProperties;
import java.lang.reflect.Field;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link RestTemplateConfig}.
 */
class RestTemplateConfigTest {

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
        properties.setConnectTimeoutMs(1500);
        properties.setReadTimeoutMs(4500);

        RestTemplate restTemplate = config.dataServiceRestTemplate(builder, properties);

        ClientHttpRequestFactory requestFactory = restTemplate.getRequestFactory();
        assertThat(requestFactory).isInstanceOf(BufferingClientHttpRequestFactory.class);

        Object delegate = getFieldValue(requestFactory, "requestFactory");
        assertThat(delegate).isInstanceOf(SimpleClientHttpRequestFactory.class);

        assertThat(getIntFieldValue(delegate, "connectTimeout")).isEqualTo(1500);
        assertThat(getIntFieldValue(delegate, "readTimeout")).isEqualTo(4500);
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

    private Object getFieldValue(Object target, String fieldName) {
        Class<?> current = target.getClass();
        while (current != null) {
            try {
                Field field = current.getDeclaredField(fieldName);
                field.setAccessible(true);
                return field.get(target);
            } catch (NoSuchFieldException _) {
                current = current.getSuperclass();
            } catch (IllegalAccessException ex) {
                throw new IllegalStateException("Failed to read field: " + fieldName, ex);
            }
        }
        throw new IllegalStateException("Field not found: " + fieldName);
    }

    private int getIntFieldValue(Object target, String fieldName) {
        Object value = getFieldValue(target, fieldName);
        assertThat(value).isInstanceOf(Integer.class);
        return (Integer) value;
    }
}
