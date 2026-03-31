package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
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
 * operations, verification, and audit querying.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/credentials")
@Validated
@Tag(name = "Credential Management", description = "Secure storage, encrypted lifecycle, and access control APIs")
@Slf4j
@RequiredArgsConstructor
public class CredentialController {
    private static final int DEFAULT_PAGE = 0;
    private static final int MAX_PAGE_SIZE = 100;

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
    @GetMapping
    public ApiResponse<CredentialListResponse> getCredentials(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "0") @Min(DEFAULT_PAGE) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size) {
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
    @GetMapping("/all")
    public ApiResponse<List<CredentialResponse>> getAllCredentials(
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
    @GetMapping("/{id}")
    public ApiResponse<CredentialResponse> getCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
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
    @GetMapping("/{id}/detail")
    public ApiResponse<CredentialDetailResponse> getCredentialDetail(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
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
    @PostMapping
    public ApiResponse<CredentialResponse> createCredential(
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
    @PutMapping("/{id}")
    public ApiResponse<CredentialResponse> updateCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
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
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
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
    @PostMapping("/{id}/verify")
    public ApiResponse<VerifyCredentialResponse> verifyCredential(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
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
    @GetMapping("/audit-logs")
    public ApiResponse<List<CredentialAuditLogResponse>> getAuditLogs(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "0") @Min(DEFAULT_PAGE) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size) {
        Long userId = requireUserId(userPrincipal);
        log.info("Get audit logs: userId={}, page={}, size={}", userId, page, size);
        List<CredentialAuditLogResponse> logs = credentialService.getAuditLogs(userId, page, size);
        return ApiResponse.success(logs);
    }

    private Long requireUserId(UserPrincipal userPrincipal) {
        return authenticatedUserResolver.requireUserId(userPrincipal);
    }
}
