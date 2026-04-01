package com.koduck.controller;
import com.koduck.common.constants.HttpHeaderConstants;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.auth.ForgotPasswordRequest;
import com.koduck.dto.auth.LoginRequest;
import com.koduck.dto.auth.RefreshTokenRequest;
import com.koduck.dto.auth.RegisterRequest;
import com.koduck.dto.auth.ResetPasswordRequest;
import com.koduck.dto.auth.SecurityConfigResponse;
import com.koduck.dto.auth.TokenResponse;
import com.koduck.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Objects;
/**
 * Authentication REST controller.
 *
 * <p>Provides endpoints for user login, registration, token refresh and
 * password management related operations.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "认证管理", description = "用户登录、注册、Token刷新等认证相关接口")
public class AuthController {
    private static final String DEFAULT_TRUSTED_PROXIES = "127.0.0.1,::1,0:0:0:0:0:0:0:1";

    private final AuthService authService;

    @Value("${security.trusted-proxies:" + DEFAULT_TRUSTED_PROXIES + "}")
    private String trustedProxies = DEFAULT_TRUSTED_PROXIES;

    /**
     * Authenticate a user and issue JWT tokens.
     *
     * @param request login request payload
     * @param httpRequest servlet request carrying client metadata
     * @return token pair and user profile wrapped in {@link ApiResponse}
     */
    @PostMapping("/login")
    @Operation(
        summary = "用户登录",
        description = "使用用户名和密码登录，返回 JWT Token\n\n" +
                      "注意：连续登录失败超过5次将触发账号锁定，锁定时间为30分钟"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "登录成功",
            content = @Content(
                schema = @Schema(implementation = TokenResponse.class),
                examples = @ExampleObject(
                    name = "success",
                    summary = "登录成功示例",
                    value = """
                        {
                          "code": 0,
                          "message": "success",
                          "data": {
                            "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                            "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                            "tokenType": "Bearer",
                            "expiresIn": 3600,
                            "user": {
                              "id": 1,
                              "username": "john_doe",
                              "email": "john@example.com"
                            }
                          },
                          "timestamp": 1704067200000
                        }
                        """
                )
            )
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误，用户名或密码为空"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "用户名或密码错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "账号已被锁定或禁用"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "429", description = "登录请求过于频繁，触发限流"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    public ApiResponse<TokenResponse> login(
            @Valid @RequestBody LoginRequest request,
            @Parameter(description = "HTTP请求对象，用于获取客户端IP", hidden = true)
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        String userAgent = httpRequest.getHeader(HttpHeaderConstants.USER_AGENT);
        TokenResponse response = authService.login(request, ipAddress, userAgent);
        return ApiResponse.success(response);
    }

    /**
     * Register a new user account.
     *
     * @param request registration request payload
     * @return token pair and user profile for the created account
     */
    @PostMapping("/register")
    @Operation(
        summary = "用户注册",
        description = "注册新用户账号，注册成功后自动登录并返回 Token"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "注册成功",
            content = @Content(schema = @Schema(implementation = TokenResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误，用户名或密码不符合要求"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "用户名或邮箱已被注册"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    public ApiResponse<TokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        TokenResponse response = authService.register(request);
        return ApiResponse.success(response);
    }

    /**
     * Refresh an access token using a valid refresh token.
     *
     * @param request refresh token request payload
     * @return newly issued token pair wrapped in {@link ApiResponse}
     */
    @PostMapping("/refresh")
    @Operation(
        summary = "刷新 Token",
        description = "使用 Refresh Token 获取新的 Access Token\n\n" +
                      "注意：Refresh Token 也有过期时间（默认7天），过期后需要重新登录"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "刷新成功",
            content = @Content(schema = @Schema(implementation = TokenResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Refresh Token 为空"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Refresh Token 无效或已过期"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    public ApiResponse<TokenResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        TokenResponse response = authService.refreshToken(request);
        return ApiResponse.success(response);
    }

    /**
     * Logout current session by revoking refresh token when provided.
     *
     * @param request optional refresh token payload
     * @return empty success response
     */
    @PostMapping("/logout")
    @Operation(
        summary = "用户登出",
        description = "注销当前用户的登录状态，使 Refresh Token 失效"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "登出成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    public ApiResponse<Void> logout(@Valid @RequestBody(required = false) RefreshTokenRequest request) {
        String refreshToken = normalizeRefreshToken(request);
        authService.logout(refreshToken);
        return ApiResponse.successNoContent();
    }

    /**
     * Retrieve security-related client configuration.
     *
     * @return security configuration payload
     */
    @GetMapping("/security-config")
    @Operation(
        summary = "获取安全配置",
        description = "获取前端需要的安全配置信息，如是否开启验证码、密码复杂度要求等"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = SecurityConfigResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    public ApiResponse<SecurityConfigResponse> getSecurityConfig() {
        SecurityConfigResponse config = authService.getSecurityConfig();
        return ApiResponse.success(config);
    }

    /**
     * Trigger forgot-password flow for an email address.
     *
     * @param request forgot-password request payload
     * @param httpRequest servlet request carrying client metadata
     * @return empty success response
     */
    @PostMapping("/forgot-password")
    @Operation(
        summary = "忘记密码",
        description = "发送密码重置邮件到用户邮箱\n\n" +
                      "注意：邮件发送可能有延迟，请耐心等待；如果邮箱未注册，也会返回成功以避免邮箱枚举攻击"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "重置邮件已发送（或邮箱不存在）"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "邮箱格式不正确"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "429", description = "请求过于频繁，请稍后再试"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    public ApiResponse<Void> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            @Parameter(description = "HTTP请求对象，用于获取客户端IP", hidden = true)
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        authService.forgotPassword(request, ipAddress);
        return ApiResponse.successNoContent();
    }

    /**
     * Reset password using a reset token.
     *
     * @param request reset-password request payload
     * @return empty success response
     */
    @PostMapping("/reset-password")
    @Operation(
        summary = "重置密码",
        description = "使用重置令牌设置新密码\n\n" +
                      "注意：重置令牌有效期为30分钟，使用后立即失效"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "密码重置成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误或新密码不符合要求"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "重置令牌无效或已过期"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.successNoContent();
    }

    /**
     * Resolve client IP address from trusted proxy headers.
     *
     * @param request current HTTP request
     * @return resolved client IP address
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (!isTrustedProxy(remoteAddr)) {
            return remoteAddr;
        }

        String xForwardedFor = request.getHeader(HttpHeaderConstants.X_FORWARDED_FOR);
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            String[] forwardedIps = xForwardedFor.split(",");
            if (forwardedIps.length > 0 && !forwardedIps[0].isBlank()) {
                return forwardedIps[0].trim();
            }
        }

        String xRealIp = request.getHeader(HttpHeaderConstants.X_REAL_IP);
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp.trim();
        }
        return remoteAddr;
    }

    private boolean isTrustedProxy(String remoteAddr) {
        if (remoteAddr == null || remoteAddr.isBlank()) {
            return false;
        }
        Set<String> trustedProxySet = Arrays.stream(trustedProxies.split(","))
            .map(String::trim)
            .filter(ip -> !ip.isEmpty())
            .collect(java.util.stream.Collectors.toSet());
        return trustedProxySet.contains(remoteAddr.trim());
    }

    private String normalizeRefreshToken(RefreshTokenRequest request) {
        if (request == null) {
            return null;
        }
        String refreshToken = request.getRefreshToken();
        if (refreshToken == null) {
            return null;
        }
        String trimmedToken = refreshToken.trim();
        return Objects.equals(trimmedToken, "") ? null : trimmedToken;
    }
}
