package com.koduck.client.exception;

/**
 * AuthClient 调用异常。
 *
 * <p>封装 koduck-user 调用 koduck-auth 过程中发生的错误，
 * 包括认证失败、网络错误、服务端错误等。</p>
 */
public class AuthClientException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public AuthClientException(String message) {
        super(message);
    }

    public AuthClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
