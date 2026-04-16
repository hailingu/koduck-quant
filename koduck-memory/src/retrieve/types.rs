//! Types for memory retrieval strategies.

use serde::{Deserialize, Serialize};

/// Context for memory retrieval operations.
#[derive(Debug, Clone)]
pub struct RetrieveContext {
    pub tenant_id: String,
    pub session_id: Option<String>,
    pub domain_class: String,
    pub domain_classes: Vec<String>,
    pub entities: Vec<String>,
    pub relation_types: Vec<String>,
    pub intent_type: String,
    pub intent_aux: Vec<String>,
    pub recall_target_type: Option<String>,
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
            domain_classes: Vec::new(),
            entities: Vec::new(),
            relation_types: Vec::new(),
            intent_type: "none".to_string(),
            intent_aux: Vec::new(),
            recall_target_type: None,
            query_text: query_text.into(),
            top_k: top_k.max(1).min(100), // Clamp between 1 and 100
        }
    }

    pub fn with_session_id(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }

    pub fn with_query_analysis(
        mut self,
        domain_classes: Vec<String>,
        entities: Vec<String>,
        relation_types: Vec<String>,
        intent_type: impl Into<String>,
        intent_aux: Vec<String>,
        recall_target_type: Option<String>,
    ) -> Self {
        if let Some(primary_domain_class) = domain_classes.first() {
            self.domain_class = primary_domain_class.clone();
        }
        self.domain_classes = domain_classes;
        self.entities = entities;
        self.relation_types = relation_types;
        self.intent_type = intent_type.into();
        self.intent_aux = intent_aux;
        self.recall_target_type = recall_target_type;
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
    pub const HISTORY: &str = "history";
    pub const POLITICS: &str = "politics";
    pub const LITERATURE: &str = "literature";
    pub const PHYSICS: &str = "physics";
    pub const MATHEMATICS: &str = "mathematics";
    pub const CHEMISTRY: &str = "chemistry";
    pub const BIOLOGY: &str = "biology";
    pub const COMPUTER_SCIENCE: &str = "computer_science";
    pub const TECHNOLOGY: &str = "technology";
    pub const ENGINEERING: &str = "engineering";
    pub const FINANCE: &str = "finance";
    pub const ECONOMICS: &str = "economics";
    pub const BUSINESS: &str = "business";
    pub const LAW: &str = "law";
    pub const PHILOSOPHY: &str = "philosophy";
    pub const PSYCHOLOGY: &str = "psychology";
    pub const EDUCATION: &str = "education";
    pub const MEDICINE: &str = "medicine";
    pub const GEOGRAPHY: &str = "geography";
    pub const ART: &str = "art";
    pub const MUSIC: &str = "music";
    pub const LANGUAGE: &str = "language";
    pub const SPORTS: &str = "sports";
    pub const FOOD: &str = "food";
    pub const ENTERTAINMENT: &str = "entertainment";
    pub const RELIGION: &str = "religion";
    pub const MILITARY: &str = "military";
    pub const UNKNOWN: &str = "unknown";

    pub const ALL: [&str; 28] = [
        HISTORY,
        POLITICS,
        LITERATURE,
        PHYSICS,
        MATHEMATICS,
        CHEMISTRY,
        BIOLOGY,
        COMPUTER_SCIENCE,
        TECHNOLOGY,
        ENGINEERING,
        FINANCE,
        ECONOMICS,
        BUSINESS,
        LAW,
        PHILOSOPHY,
        PSYCHOLOGY,
        EDUCATION,
        MEDICINE,
        GEOGRAPHY,
        ART,
        MUSIC,
        LANGUAGE,
        SPORTS,
        FOOD,
        ENTERTAINMENT,
        RELIGION,
        MILITARY,
        UNKNOWN,
    ];

    /// Validate if the given domain class is supported.
    pub fn is_valid(domain_class: &str) -> bool {
        ALL.contains(&domain_class)
    }

    /// Get default domain class.
    pub fn default() -> &'static str {
        UNKNOWN
    }
}

/// Match reasons for memory hits.
pub mod match_reason {
    use std::collections::BTreeSet;

    pub const DOMAIN_HIT: &str = "domain_hit";
    pub const ENTITY_HIT: &str = "entity_hit";
    pub const RELATION_HIT: &str = "relation_hit";
    pub const DISCOURSE_ACTION_HIT: &str = "discourse_action_hit";
    pub const SESSION_SCOPE_HIT: &str = "session_scope_hit";
    pub const SUMMARY_HIT: &str = "summary_hit";
    pub const FACT_HIT: &str = "fact_hit";
    pub const RECENCY_BOOST: &str = "recency_boost";

    const CLOSED_SET: [&str; 8] = [
        DOMAIN_HIT,
        ENTITY_HIT,
        RELATION_HIT,
        DISCOURSE_ACTION_HIT,
        SESSION_SCOPE_HIT,
        SUMMARY_HIT,
        FACT_HIT,
        RECENCY_BOOST,
    ];

    pub fn is_closed_set_value(reason: &str) -> bool {
        CLOSED_SET.contains(&reason)
    }

    pub fn normalize_output(reasons: Vec<String>) -> Vec<String> {
        reasons
            .into_iter()
            .map(|reason| reason.trim().to_string())
            .filter(|reason| !reason.is_empty() && is_closed_set_value(reason))
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect()
    }
}
