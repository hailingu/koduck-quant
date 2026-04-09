package com.koduck.client;

import com.koduck.client.dto.TokenIntrospectionResponse;
import com.koduck.client.dto.TokenRevocationRequest;

/**
 * Auth 服务客户端接口。
 *
 * <p>封装 koduck-user 对 koduck-auth 的反向调用（Token 自省/吊销）。
 * 所有调用通过 APISIX 网关进行，受 {@code auth.introspection.enabled} 开关控制。</p>
 */
public interface AuthClient {

    /**
     * 自省 Token 有效性。
     *
     * @param token JWT access token
     * @return 自省结果，包含有效性、用户信息等
     */
    TokenIntrospectionResponse introspectToken(String token);

    /**
     * 吊销指定用户的所有 Token。
     *
     * @param request 吊销请求（包含用户ID和原因）
     */
    void revokeTokens(TokenRevocationRequest request);
}
