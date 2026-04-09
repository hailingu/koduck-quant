package com.koduck.client;

import com.koduck.client.dto.TokenIntrospectionResponse;
import com.koduck.client.dto.TokenRevocationRequest;
import com.koduck.client.exception.AuthClientException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * AuthClient 空实现。
 *
 * <p>当 {@code auth.introspection.enabled=false}（默认）时使用，
 * 确保 koduck-user 不会发起任何到 koduck-auth 的调用。</p>
 */
@Component
@ConditionalOnProperty(prefix = "auth.introspection", name = "enabled", havingValue = "false", matchIfMissing = true)
public class AuthClientNoOp implements AuthClient {

    private static final Logger log = LoggerFactory.getLogger(AuthClientNoOp.class);

    @Override
    public TokenIntrospectionResponse introspectToken(String token) {
        throw new AuthClientException("AuthClient introspection 未启用（auth.introspection.enabled=false）");
    }

    @Override
    public void revokeTokens(TokenRevocationRequest request) {
        throw new AuthClientException("AuthClient introspection 未启用（auth.introspection.enabled=false）");
    }
}
