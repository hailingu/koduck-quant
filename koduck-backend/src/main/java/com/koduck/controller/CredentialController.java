package com.koduck.controller;

import com.koduck.common.constants.PaginationConstants;
import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.credential.CreateCredentialRequest;
import com.koduck.dto.credential.CredentialAuditLogResponse;
import com.koduck.dto.credential.CredentialDetailResponse;
import com.koduck.dto.credential.CredentialListResponse;
import com.koduck.dto.credential.CredentialResponse;
import com.koduck.dto.credential.UpdateCredentialRequest;
import com.koduck.dto.credential.VerifyCredentialResponse;
import com.koduck.security.UserPrincipal;
import com.koduck.service.CredentialService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for credential management.
 *
 * <p>Provides endpoints for secure API credential storage, encryption lifecycle
 * operations, verification, and audit querying.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/credentials")
@Validated
@Tag(name = "凭证管理", description = "API凭证安全存储、生命周期管理和访问控制接口")
@SecurityRequirement(name = "bearerAuth")
@Slf4j
@RequiredArgsConstructor
public class CredentialController {

    private final CredentialService credentialService;
    private final AuthenticatedUserResolver authenticatedUserResolver;

    /**
     * Retrieve paged credential summaries for the authenticated user.
     *
     * @param userPrincipal authenticated principal
     * @param page zero-based page index, must be greater than or equal to 0
     * @param size page size, must be between 1 and 100
     * @return paged credential response payload
     */
    @Operation(
        summary = "获取凭证列表",
        description = "分页获取当前用户的API凭证列表（脱敏显示）"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = CredentialListResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<CredentialListResponse> getCredentials(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "页码，从0开始", example = "0")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_ZERO_STR)
            @Min(PaginationConstants.DEFAULT_PAGE_ZERO) int page,
            @Parameter(description = "每页数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR)
            @Min(1) @Max(PaginationConstants.MAX_PAGE_SIZE) int size) {
        Long userId = requireUserId(userPrincipal);
        log.info("List credentials: userId={}, page={}, size={}", userId, page, size);
        CredentialListResponse response = credentialService.getCredentials(userId, page, size);
        return ApiResponse.success(response);
    }

    /**
     * Retrieve all credentials without pagination.
     *
     * @param userPrincipal authenticated principal
     * @return full credential list
     */
    @Operation(
        summary = "获取所有凭证",
        description = "获取当前用户的所有API凭证（脱敏显示，不分页）"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = CredentialResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/all")
    public ApiResponse<List<CredentialResponse>> getAllCredentials(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.info("List all credentials: userId={}", userId);
        List<CredentialResponse> credentials = credentialService.getAllCredentials(userId);
        return ApiResponse.success(credentials);
    }

    /**
     * Retrieve a masked credential by id.
     *
     * @param userPrincipal authenticated principal
     * @param id credential identifier
     * @return masked credential information
     */
    @Operation(
        summary = "获取凭证详情",
        description = "获取指定ID的凭证详情（脱敏显示）"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = CredentialResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权访问该凭证"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "凭证不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{id}")
    public ApiResponse<CredentialResponse> getCredential(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "凭证ID", example = "1")
            @PathVariable Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Get credential summary: userId={}, credentialId={}", userId, id);
        CredentialResponse credential = credentialService.getCredential(userId, id);
        return ApiResponse.success(credential);
    }

    /**
     * Retrieve complete credential details, including decrypted API key and secret.
     *
     * @param userPrincipal authenticated principal
     * @param id credential identifier
     * @return full credential detail response
     */
    @Operation(
        summary = "获取凭证完整详情",
        description = "获取指定ID的凭证完整详情，包含解密后的密钥\n\n" +
                      "注意：此接口会记录审计日志"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = CredentialDetailResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权访问该凭证"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "凭证不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{id}/detail")
    public ApiResponse<CredentialDetailResponse> getCredentialDetail(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "凭证ID", example = "1")
            @PathVariable Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Get credential detail: userId={}, credentialId={}", userId, id);
        CredentialDetailResponse credential = credentialService.getCredentialDetail(userId, id);
        return ApiResponse.success(credential);
    }

    /**
     * Create a new credential for the authenticated user.
     *
     * @param userPrincipal authenticated principal
     * @param request credential creation request
     * @return created credential summary
     */
    @Operation(
        summary = "创建凭证",
        description = "创建新的API凭证\n\n" +
                      "密钥将被加密存储，请妥善保管原始密钥"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "创建成功",
            content = @Content(schema = @Schema(implementation = CredentialResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "凭证名称已存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping
    public ApiResponse<CredentialResponse> createCredential(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateCredentialRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.info("Create credential: userId={}, name={}", userId, request.getName());
        CredentialResponse credential = credentialService.createCredential(userId, request);
        return ApiResponse.success(credential);
    }

    /**
     * Update an existing credential.
     *
     * @param userPrincipal authenticated principal
     * @param id credential identifier
     * @param request credential update request
     * @return updated credential summary
     */
    @Operation(
        summary = "更新凭证",
        description = "更新指定ID的API凭证"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = CredentialResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权更新该凭证"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "凭证不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/{id}")
    public ApiResponse<CredentialResponse> updateCredential(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "凭证ID", example = "1")
            @PathVariable Long id,
            @Valid @RequestBody UpdateCredentialRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.info("Update credential: userId={}, credentialId={}", userId, id);
        CredentialResponse credential = credentialService.updateCredential(userId, id, request);
        return ApiResponse.success(credential);
    }

    /**
     * Delete a credential by id.
     *
     * @param userPrincipal authenticated principal
     * @param id credential identifier
     * @return empty success response
     */
    @Operation(
        summary = "删除凭证",
        description = "删除指定ID的API凭证\n\n" +
                      "注意：删除后无法恢复"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权删除该凭证"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "凭证不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteCredential(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "凭证ID", example = "1")
            @PathVariable Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Delete credential: userId={}, credentialId={}", userId, id);
        credentialService.deleteCredential(userId, id);
        return ApiResponse.successNoContent();
    }

    /**
     * Verify credential connectivity and validity.
     *
     * @param userPrincipal authenticated principal
     * @param id credential identifier
     * @return credential verification result
     */
    @Operation(
        summary = "验证凭证",
        description = "验证指定凭证的有效性和连通性"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "验证完成",
            content = @Content(schema = @Schema(implementation = VerifyCredentialResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "无权访问该凭证"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "凭证不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PostMapping("/{id}/verify")
    public ApiResponse<VerifyCredentialResponse> verifyCredential(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "凭证ID", example = "1")
            @PathVariable Long id) {
        Long userId = requireUserId(userPrincipal);
        log.info("Verify credential: userId={}, credentialId={}", userId, id);
        VerifyCredentialResponse result = credentialService.verifyCredential(userId, id);
        return ApiResponse.success(result);
    }

    /**
     * Retrieve credential audit logs with pagination.
     *
     * @param userPrincipal authenticated principal
     * @param page zero-based page index, must be greater than or equal to 0
     * @param size page size, must be between 1 and 100
     * @return list of audit log records
     */
    @Operation(
        summary = "获取审计日志",
        description = "获取凭证访问审计日志"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = CredentialAuditLogResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/audit-logs")
    public ApiResponse<List<CredentialAuditLogResponse>> getAuditLogs(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Parameter(description = "页码，从0开始", example = "0")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_ZERO_STR)
            @Min(PaginationConstants.DEFAULT_PAGE_ZERO) int page,
            @Parameter(description = "每页数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR)
            @Min(1) @Max(PaginationConstants.MAX_PAGE_SIZE) int size) {
        Long userId = requireUserId(userPrincipal);
        log.info("Get audit logs: userId={}, page={}, size={}", userId, page, size);
        List<CredentialAuditLogResponse> logs = credentialService.getAuditLogs(userId, page, size);
        return ApiResponse.success(logs);
    }

    private Long requireUserId(UserPrincipal userPrincipal) {
        return authenticatedUserResolver.requireUserId(userPrincipal);
    }
}
