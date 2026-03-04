package com.koduck.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lightweight tests for {@link OpenApiConfig}.
 */
class OpenApiConfigTest {

    /**
     * Verifies generated server entries and bearer security scheme details.
     */
    /**
     * Validates that server URLs and the JWT bearer security scheme are
     * correctly populated in the generated OpenAPI definition.
     */
    @Test
    @DisplayName("shouldGenerateExpectedServersAndSecurityScheme")
    void shouldGenerateExpectedServersAndSecurityScheme() {
        OpenApiConfig config = new OpenApiConfig();
        setField(config, "serverPort", 9090);

        OpenAPI openApi = config.customOpenAPI();

        List<Server> servers = openApi.getServers();
        assertThat(servers).hasSize(2);
        assertThat(servers.get(0).getUrl()).isEqualTo("http://localhost:9090");
        assertThat(servers.get(0).getDescription()).isEqualTo("Local development server");
        assertThat(servers.get(1).getUrl()).isEqualTo("/");
        assertThat(servers.get(1).getDescription()).isEqualTo("Current service endpoint");

        SecurityScheme securityScheme = openApi.getComponents()
                .getSecuritySchemes()
                .get("bearerAuth");
        assertThat(securityScheme).isNotNull();
        assertThat(securityScheme.getType()).isEqualTo(SecurityScheme.Type.HTTP);
        assertThat(securityScheme.getScheme()).isEqualTo("bearer");
        assertThat(securityScheme.getBearerFormat()).isEqualTo("JWT");
        assertThat(securityScheme.getDescription()).isEqualTo("Enter JWT token in the format: Bearer {token}");

        assertThat(openApi.getSecurity())
            .isNotNull()
            .hasSize(1);
        assertThat(openApi.getSecurity().get(0).get("bearerAuth"))
            .isNotNull();
    }

    /**
     * Sets private field values on the target object for isolated testing.
     *
     * @param target target object
     * @param fieldName field name
     * @param value field value
     */
    private void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("Failed to set field: " + fieldName, ex);
        }
    }
}