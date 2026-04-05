package com.koduck.infrastructure.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;

/**
 * Properties for STOMP broker relay configuration.
 * <p>
 * This class binds the prefix {@code koduck.websocket.stomp-relay} and provides
 * configuration for connecting to an external STOMP broker (e.g., RabbitMQ).
 * </p>
 *
 * @author Koduck Team
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "koduck.websocket.stomp-relay")
public class StompRelayProperties {

    /**
     * Default STOMP broker port for RabbitMQ STOMP plugin.
     */
    private static final int DEFAULT_STOMP_PORT = 61613;

    /**
     * Default heartbeat interval in milliseconds.
     */
    private static final long DEFAULT_HEARTBEAT_INTERVAL = 10000;

    /**
     * Whether to enable STOMP broker relay (external broker).
     * When false, uses in-memory SimpleBroker (development mode).
     */
    private boolean enabled = false;

    /**
     * STOMP broker host (RabbitMQ hostname).
     */
    private String host = "localhost";

    /**
     * STOMP broker port (RabbitMQ STOMP plugin port).
     * Default is 61613 for RabbitMQ STOMP plugin.
     */
    private int port = DEFAULT_STOMP_PORT;

    /**
     * Username for STOMP broker authentication.
     */
    private String username = "guest";

    /**
     * Password for STOMP broker authentication.
     */
    private String password = "guest";

    /**
     * Virtual host for STOMP broker.
     */
    private String virtualHost = "/";

    /**
     * System login for STOMP relay (internal Spring messaging).
     * Defaults to username if not set.
     */
    private String systemLogin;

    /**
     * System passcode for STOMP relay (internal Spring messaging).
     * Defaults to password if not set.
     */
    private String systemPasscode;

    /**
     * Heartbeat send interval in milliseconds.
     */
    private long systemHeartbeatSendInterval = DEFAULT_HEARTBEAT_INTERVAL;

    /**
     * Heartbeat receive interval in milliseconds.
     */
    private long systemHeartbeatReceiveInterval = DEFAULT_HEARTBEAT_INTERVAL;

    /**
     * Returns the system login, defaulting to username if not set.
     *
     * @return system login
     */
    public String getSystemLogin() {
        return systemLogin != null && !systemLogin.isEmpty() ? systemLogin : username;
    }

    /**
     * Returns the system passcode, defaulting to password if not set.
     *
     * @return system passcode
     */
    public String getSystemPasscode() {
        return systemPasscode != null && !systemPasscode.isEmpty() ? systemPasscode : password;
    }
}
