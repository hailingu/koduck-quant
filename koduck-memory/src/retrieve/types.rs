//! Types for memory retrieval strategies.

use serde::{Deserialize, Serialize};

/// Context for memory retrieval operations.
#[derive(Debug, Clone)]
pub struct RetrieveContext {
    pub tenant_id: String,
    pub session_id: Option<String>,
    pub domain_class: String,
    pub query_text: String,
    pub top_k: i32,
}

impl RetrieveContext {
    pub fn new(
        tenant_id: impl Into<String>,
        domain_class: impl Into<String>,
        query_text: impl Into<String>,
        top_k: i32,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id: None,
            domain_class: domain_class.into(),
            query_text: query_text.into(),
            top_k: top_k.max(1).min(100), // Clamp between 1 and 100
        }
    }

    pub fn with_session_id(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }
}

/// Result of a memory retrieval operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrieveResult {
    pub session_id: String,
    pub l0_uri: String,
    pub score: f32,
    pub match_reasons: Vec<String>,
    pub snippet: String,
}

impl RetrieveResult {
    pub fn new(
        session_id: impl Into<String>,
        l0_uri: impl Into<String>,
        score: f32,
        snippet: impl Into<String>,
    ) -> Self {
        Self {
            session_id: session_id.into(),
            l0_uri: l0_uri.into(),
            score,
            match_reasons: Vec::new(),
            snippet: snippet.into(),
        }
    }

    pub fn with_match_reason(mut self, reason: impl Into<String>) -> Self {
        self.match_reasons.push(reason.into());
        self
    }
}

/// Supported domain classes for memory classification.
pub mod domain_class {
    pub const CHAT: &str = "chat";
    pub const TASK: &str = "task";
    pub const SYSTEM: &str = "system";
    pub const SUMMARY: &str = "summary";
    pub const FACT: &str = "fact";
    pub const UNKNOWN: &str = "unknown";

    /// Validate if the given domain class is supported.
    pub fn is_valid(domain_class: &str) -> bool {
        matches!(
            domain_class,
            CHAT | TASK | SYSTEM | SUMMARY | FACT | UNKNOWN
        )
    }

    /// Get default domain class.
    pub fn default() -> &'static str {
        CHAT
    }
}

/// Match reasons for memory hits.
pub mod match_reason {
    pub const DOMAIN_CLASS_HIT: &str = "domain_class_hit";
    pub const SESSION_SCOPE_HIT: &str = "session_scope_hit";
    pub const SUMMARY_HIT: &str = "summary_hit";
    pub const KEYWORD_HIT: &str = "keyword_hit";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retrieve_context_builder_works() {
        let ctx = RetrieveContext::new("tenant-1", "chat", "query", 10)
            .with_session_id("session-1");

        assert_eq!(ctx.tenant_id, "tenant-1");
        assert_eq!(ctx.session_id, Some("session-1".to_string()));
        assert_eq!(ctx.domain_class, "chat");
        assert_eq!(ctx.query_text, "query");
        assert_eq!(ctx.top_k, 10);
    }

    #[test]
    fn retrieve_context_clamps_top_k() {
        let ctx_low = RetrieveContext::new("t", "c", "q", 0);
        assert_eq!(ctx_low.top_k, 1);

        let ctx_high = RetrieveContext::new("t", "c", "q", 200);
        assert_eq!(ctx_high.top_k, 100);
    }

    #[test]
    fn retrieve_result_builder_works() {
        let result = RetrieveResult::new("session-1", "s3://bucket/obj", 0.85, "snippet")
            .with_match_reason("domain_class_hit")
            .with_match_reason("session_scope_hit");

        assert_eq!(result.session_id, "session-1");
        assert_eq!(result.l0_uri, "s3://bucket/obj");
        assert!((result.score - 0.85).abs() < f32::EPSILON);
        assert_eq!(result.snippet, "snippet");
        assert_eq!(result.match_reasons.len(), 2);
        assert!(result.match_reasons.contains(&"domain_class_hit".to_string()));
    }

    #[test]
    fn domain_class_validation_works() {
        assert!(domain_class::is_valid("chat"));
        assert!(domain_class::is_valid("task"));
        assert!(domain_class::is_valid("system"));
        assert!(domain_class::is_valid("summary"));
        assert!(domain_class::is_valid("fact"));
        assert!(domain_class::is_valid("unknown"));
        assert!(!domain_class::is_valid("invalid"));
    }
}
