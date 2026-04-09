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

    private static final Logger log = LoggerFactory.getLogger(InternalUserController.class);

    private final UserService userService;

    public InternalUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/users/by-username/{username}")
    public ResponseEntity<UserDetailsResponse> findByUsername(
            @PathVariable String username,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        logAudit(consumer, "findByUsername", username);
        return userService.findByUsername(username)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/users/by-email/{email}")
    public ResponseEntity<UserDetailsResponse> findByEmail(
            @PathVariable String email,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        logAudit(consumer, "findByEmail", email);
        return userService.findByEmail(email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/users")
    public ResponseEntity<UserDetailsResponse> createUser(
            @RequestBody @Valid CreateUserRequest request,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        logAudit(consumer, "createUser", request.getUsername());
        return ResponseEntity.ok(userService.createUser(request));
    }

    @PutMapping("/users/{userId}/last-login")
    public ResponseEntity<Void> updateLastLogin(
            @PathVariable Long userId,
            @RequestBody @Valid LastLoginUpdateRequest request,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        logAudit(consumer, "updateLastLogin", String.valueOf(userId));
        userService.updateLastLogin(userId, request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/users/{userId}/roles")
    public ResponseEntity<List<String>> getUserRoles(
            @PathVariable Long userId,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        logAudit(consumer, "getUserRoles", String.valueOf(userId));
        return ResponseEntity.ok(userService.getUserRoles(userId));
    }

    @GetMapping("/users/{userId}/permissions")
    public ResponseEntity<List<String>> getUserPermissions(
            @PathVariable Long userId,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        logAudit(consumer, "getUserPermissions", String.valueOf(userId));
        return ResponseEntity.ok(userService.getUserPermissions(userId));
    }

    private void logAudit(String consumer, String action, String target) {
        String consumerName = (consumer == null || consumer.isBlank()) ? "unknown" : consumer;
        log.info("internal-api action={} target={} consumer={}", action, target, consumerName);
    }
}
