package com.koduck.controller.user;

import com.koduck.dto.user.user.CreateUserRequest;
import com.koduck.dto.user.user.LastLoginUpdateRequest;
import com.koduck.dto.user.user.UserDetailsResponse;
import com.koduck.service.UserService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户内部接口 Controller，供 koduck-auth 等内部服务调用。
 */
@RestController
@RequestMapping("/internal")
public class InternalUserController {

    private static final String DEFAULT_TENANT_ID = "default";
    private static final Logger log = LoggerFactory.getLogger(InternalUserController.class);

    private final UserService userService;

    public InternalUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/users/by-username/{username}")
    public ResponseEntity<UserDetailsResponse> findByUsername(
            @PathVariable String username,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        String consumerName = requireConsumer(consumer);
        String resolvedTenantId = resolveTenantId(tenantId);
        logAudit(consumerName, resolvedTenantId, "findByUsername", username);
        return userService.findByUsername(resolvedTenantId, username)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/users/by-email/{email}")
    public ResponseEntity<UserDetailsResponse> findByEmail(
            @PathVariable String email,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        String consumerName = requireConsumer(consumer);
        String resolvedTenantId = resolveTenantId(tenantId);
        logAudit(consumerName, resolvedTenantId, "findByEmail", email);
        return userService.findByEmail(resolvedTenantId, email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/users")
    public ResponseEntity<UserDetailsResponse> createUser(
            @RequestBody @Valid CreateUserRequest request,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        String consumerName = requireConsumer(consumer);
        String resolvedTenantId = resolveTenantId(tenantId);
        logAudit(consumerName, resolvedTenantId, "createUser", request.getUsername());
        return ResponseEntity.ok(userService.createUser(resolvedTenantId, request));
    }

    @PutMapping("/users/{userId}/last-login")
    public ResponseEntity<Void> updateLastLogin(
            @PathVariable Long userId,
            @RequestBody @Valid LastLoginUpdateRequest request,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        String consumerName = requireConsumer(consumer);
        String resolvedTenantId = resolveTenantId(tenantId);
        logAudit(consumerName, resolvedTenantId, "updateLastLogin", String.valueOf(userId));
        userService.updateLastLogin(resolvedTenantId, userId, request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/users/{userId}/roles")
    public ResponseEntity<List<String>> getUserRoles(
            @PathVariable Long userId,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        String consumerName = requireConsumer(consumer);
        String resolvedTenantId = resolveTenantId(tenantId);
        logAudit(consumerName, resolvedTenantId, "getUserRoles", String.valueOf(userId));
        return ResponseEntity.ok(userService.getUserRoles(resolvedTenantId, userId));
    }

    @GetMapping("/users/{userId}/permissions")
    public ResponseEntity<List<String>> getUserPermissions(
            @PathVariable Long userId,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        String consumerName = requireConsumer(consumer);
        String resolvedTenantId = resolveTenantId(tenantId);
        logAudit(consumerName, resolvedTenantId, "getUserPermissions", String.valueOf(userId));
        return ResponseEntity.ok(userService.getUserPermissions(resolvedTenantId, userId));
    }

    private String requireConsumer(String consumer) {
        if (consumer == null || consumer.isBlank()) {
            throw new IllegalStateException("缺少内部调用身份信息: X-Consumer-Username");
        }
        return consumer;
    }

    private String resolveTenantId(String tenantId) {
        return (tenantId == null || tenantId.isBlank()) ? DEFAULT_TENANT_ID : tenantId;
    }

    private void logAudit(String consumer, String tenantId, String action, String target) {
        String consumerName = (consumer == null || consumer.isBlank()) ? "unknown" : consumer;
        log.info("internal-api action={} target={} consumer={} tenantId={}", action, target, consumerName, tenantId);
    }
}
