//! IP address utilities

use std::net::SocketAddr;

/// Extract client IP address from various sources
pub fn extract_client_ip(
    connect_info: &SocketAddr,
    forwarded_for: Option<&str>,
    real_ip: Option<&str>,
) -> String {
    // Priority: X-Real-IP > X-Forwarded-For > ConnectInfo
    if let Some(ip) = real_ip {
        return ip.split(',').next().unwrap_or(ip).trim().to_string();
    }

    if let Some(ip) = forwarded_for {
        return ip.split(',').next().unwrap_or(ip).trim().to_string();
    }

    connect_info.ip().to_string()
}

/// Check if IP is in private range
pub fn is_private_ip(ip: &str) -> bool {
    // Simple check for common private IP ranges
    ip.starts_with("10.")
        || ip.starts_with("172.16.")
        || ip.starts_with("172.17.")
        || ip.starts_with("172.18.")
        || ip.starts_with("172.19.")
        || ip.starts_with("172.20.")
        || ip.starts_with("172.21.")
        || ip.starts_with("172.22.")
        || ip.starts_with("172.23.")
        || ip.starts_with("172.24.")
        || ip.starts_with("172.25.")
        || ip.starts_with("172.26.")
        || ip.starts_with("172.27.")
        || ip.starts_with("172.28.")
        || ip.starts_with("172.29.")
        || ip.starts_with("172.30.")
        || ip.starts_with("172.31.")
        || ip.starts_with("192.168.")
        || ip == "127.0.0.1"
        || ip == "::1"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_client_ip() {
        let addr: SocketAddr = "192.168.1.1:8080".parse().unwrap();
        
        // No headers
        assert_eq!(
            extract_client_ip(&addr, None, None),
            "192.168.1.1"
        );

        // With X-Forwarded-For
        assert_eq!(
            extract_client_ip(&addr, Some("10.0.0.1, 10.0.0.2"), None),
            "10.0.0.1"
        );

        // With X-Real-IP (higher priority)
        assert_eq!(
            extract_client_ip(&addr, Some("10.0.0.1"), Some("10.0.0.2")),
            "10.0.0.2"
        );
    }

    #[test]
    fn test_is_private_ip() {
        assert!(is_private_ip("10.0.0.1"));
        assert!(is_private_ip("172.16.0.1"));
        assert!(is_private_ip("192.168.1.1"));
        assert!(is_private_ip("127.0.0.1"));
        assert!(!is_private_ip("8.8.8.8"));
    }
}
