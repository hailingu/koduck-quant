package com.koduck.config;

import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only controller exposing endpoints for security rule verification.
 *
 * @author GitHub Copilot
 */
@RestController
@Profile("security-config-test")
public class SecurityTestEndpointsController {

    @GetMapping("/api/v1/auth/ping")
    public ResponseEntity<String> authPing() {
        return ResponseEntity.ok("ok");
    }

    @GetMapping("/api/v1/health/ping")
    public ResponseEntity<String> healthPing() {
        return ResponseEntity.ok("ok");
    }

    @GetMapping("/api/v1/market/ping")
    public ResponseEntity<String> marketPing() {
        return ResponseEntity.ok("ok");
    }

    @GetMapping("/api/v1/private/ping")
    public ResponseEntity<String> privatePing() {
        return ResponseEntity.ok("ok");
    }
}
