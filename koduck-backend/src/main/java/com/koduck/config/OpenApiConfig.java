package com.koduck.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;

/**
 * OpenAPI (Swagger) configuration.
 */
@Configuration
@Profile("!prod")  // disabled in production environment
public class OpenApiConfig {

    /**
     * Port on which server is running; used to populate development server URL.
     */
    @Value("${server.port:8080}")
    private String serverPort;

    /**
     * Creates a customized OpenAPI bean including server info,
     * metadata, and security schemes. Disabled in production profile.
     */
    @Bean
    public OpenAPI customOpenAPI() {
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
                // server information
                .servers(List.of(
                        new Server().url("http://localhost:" + serverPort).description("本地开发环境"),
                        new Server().url("/").description("当前服务器")
                ))
                // API metadata
                .info(new Info()
                        .title("Koduck Quant API")
                        .version("v1.0.0")
                        .description("""
                                Koduck Quant 量化交易系统 RESTful API 文档

                                ## 认证方式
                                本 API 使用 JWT Bearer Token 进行认证。
                                1. 调用 `/api/v1/auth/login` 获取 accessToken
                                2. 在请求头中添加 `Authorization: Bearer {token}`

                                ## 响应格式
                                所有 API 返回统一的响应格式:
                                ```json
                                {
                                  "code": 0,
                                  "message": "success",
                                  "data": {},
                                  "timestamp": 1234567890
                                }
                                ```
                                """ )
                        .contact(new Contact()
                                .name("Koduck Team")
                                .url("https://github.com/hailingu/koduck-quant")
                                .email("support@koduck.com"))
                        .license(new License()
                                .name("MIT License")
                                .url("https://opensource.org/licenses/MIT"))
                )
                // security configuration
                .addSecurityItem(new SecurityRequirement()
                        .addList(securitySchemeName)
                )
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName, new SecurityScheme()
                                .name(securitySchemeName)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("请输入 JWT Token，格式: Bearer {token}")
                        )
                );
    }
}
