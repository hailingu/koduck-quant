package com.koduck.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;

/**
 * OpenAPI (Swagger) configuration for non-production environments.
 *
 * <p>Defines API metadata, server endpoints, and JWT Bearer authentication
 * settings used by the interactive API documentation.</p>
 *
 * @author Koduck Team
 */
@Configuration
@Profile("!prod")
public class OpenApiConfig {

    /** Security scheme name for bearer authentication. */
    private static final String SECURITY_SCHEME_NAME = "bearerAuth";

    /** URL prefix for local development server. */
    private static final String LOCAL_SERVER_URL_PREFIX = "http://localhost:";

    /** Current server URL indicator. */
    private static final String CURRENT_SERVER_URL = "/";

    /** OpenAPI documentation title. */
    private static final String OPENAPI_TITLE = "Koduck Quant API";

    /** OpenAPI version. */
    private static final String OPENAPI_VERSION = "v1.0.0";

    /** Team name for contact information. */
    private static final String TEAM_NAME = "Koduck Team";

    /** Team URL for contact information. */
    private static final String TEAM_URL = "https://github.com/hailingu/koduck-quant";

    /** Support email for contact information. */
    private static final String TEAM_EMAIL = "support@koduck.com";

    /** License name. */
    private static final String LICENSE_NAME = "MIT License";

    /** License URL. */
    private static final String LICENSE_URL = "https://opensource.org/licenses/MIT";

    /**
     * Port on which server is running; used to populate development server URL.
     */
    @Value("${server.port:8080}")
    private int serverPort;

    /**
     * Creates a customized OpenAPI bean including server info,
     * metadata, and security schemes. Disabled in production profile.
     *
     * @return the configured OpenAPI instance
     */
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .servers(List.of(
                        new Server().url(LOCAL_SERVER_URL_PREFIX + serverPort)
                                .description("Local development server"),
                        new Server().url(CURRENT_SERVER_URL)
                                .description("Current service endpoint")
                ))
                .info(buildInfo())
                .addSecurityItem(new SecurityRequirement()
                        .addList(SECURITY_SCHEME_NAME)
                )
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME, buildSecurityScheme())
                );
    }

    /**
     * Builds the OpenAPI info section.
     *
     * @return the API info
     */
    private Info buildInfo() {
        return new Info()
                .title(OPENAPI_TITLE)
                .version(OPENAPI_VERSION)
                .description("""
                        Koduck Quant trading system RESTful API documentation.

                        ## Authentication
                        This API uses JWT Bearer Token authentication.
                        1. Call `/api/v1/auth/login` to get an access token.
                        2. Add `Authorization: Bearer {token}` to request headers.

                        ## Response Format
                        All APIs return a unified response payload:
                        ```json
                        {
                          "code": 0,
                          "message": "success",
                          "data": {},
                          "timestamp": 1234567890
                        }
                        ```
                        """)
                .contact(new Contact()
                        .name(TEAM_NAME)
                        .url(TEAM_URL)
                        .email(TEAM_EMAIL))
                .license(new License()
                        .name(LICENSE_NAME)
                        .url(LICENSE_URL));
    }

    /**
     * Builds the security scheme configuration.
     *
     * @return the JWT bearer security scheme
     */
    private SecurityScheme buildSecurityScheme() {
        return new SecurityScheme()
                .name(SECURITY_SCHEME_NAME)
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description("Enter JWT token in the format: Bearer {token}");
    }
}
