package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.credential.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.CredentialService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 凭证管理控制器
 */
@RestController
@RequestMapping("/api/v1/credentials")
@RequiredArgsConstructor
@Tag(name = "凭证管理", description = "API Key的安全存储、加密管理和访问控制接口")
@Slf4j
public class CredentialController {

    private final CredentialService credentialService;

    /**
     * 获取凭证列表
     */
    @GetMapping
    public ApiResponse<CredentialListResponse> getCredentials(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Long userId = userPrincipal.getUser().getId();
        log.info("获取凭证列表: userId={}, page={}, size={}", userId, page, size);

        CredentialListResponse response = credentialService.getCredentials(userId, page, size);
        return ApiResponse.success(response);
    }

    /**
     * 获取所有凭证（不分页）
     */
    @GetMapping("/all")
    public ApiResponse<List<CredentialResponse>> getAllCredentials(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Long userId = userPrincipal.getUser().getId();
        log.info("获取所有凭证: userId={}", userId);

        List<CredentialResponse> credentials = credentialService.getAllCredentials(userId);
        return ApiResponse.success(credentials);
    }

    /**
     * 获取凭证详情（脱敏）
     */
    @GetMapping("/{id}")
    public ApiResponse<CredentialResponse> getCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("获取凭证详情: userId={}, credentialId={}", userId, id);

        CredentialResponse credential = credentialService.getCredential(userId, id);
        return ApiResponse.success(credential);
    }

    /**
     * 获取凭证完整信息（包含解密后的 API Key/Secret）
     */
    @GetMapping("/{id}/detail")
    public ApiResponse<CredentialDetailResponse> getCredentialDetail(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("获取凭证完整信息: userId={}, credentialId={}", userId, id);

        CredentialDetailResponse credential = credentialService.getCredentialDetail(userId, id);
        return ApiResponse.success(credential);
    }

    /**
     * 创建凭证
     */
    @PostMapping
    public ApiResponse<CredentialResponse> createCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateCredentialRequest request) {

        Long userId = userPrincipal.getUser().getId();
        log.info("创建凭证: userId={}, name={}", userId, request.getName());

        CredentialResponse credential = credentialService.createCredential(userId, request);
        return new ApiResponse<>(0, "凭证创建成功", credential);
    }

    /**
     * 更新凭证
     */
    @PutMapping("/{id}")
    public ApiResponse<CredentialResponse> updateCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateCredentialRequest request) {

        Long userId = userPrincipal.getUser().getId();
        log.info("更新凭证: userId={}, credentialId={}", userId, id);

        CredentialResponse credential = credentialService.updateCredential(userId, id, request);
        return new ApiResponse<>(0, "凭证更新成功", credential);
    }

    /**
     * 删除凭证
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("删除凭证: userId={}, credentialId={}", userId, id);

        credentialService.deleteCredential(userId, id);
        return new ApiResponse<>(0, "凭证删除成功", null);
    }

    /**
     * 验证凭证
     */
    @PostMapping("/{id}/verify")
    public ApiResponse<VerifyCredentialResponse> verifyCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {

        Long userId = userPrincipal.getUser().getId();
        log.info("验证凭证: userId={}, credentialId={}", userId, id);

        VerifyCredentialResponse result = credentialService.verifyCredential(userId, id);
        return ApiResponse.success(result);
    }

    /**
     * 获取审计日志
     */
    @GetMapping("/audit-logs")
    public ApiResponse<List<CredentialAuditLogResponse>> getAuditLogs(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Long userId = userPrincipal.getUser().getId();
        log.info("获取审计日志: userId={}, page={}, size={}", userId, page, size);

        List<CredentialAuditLogResponse> logs = credentialService.getAuditLogs(userId, page, size);
        return ApiResponse.success(logs);
    }
}
