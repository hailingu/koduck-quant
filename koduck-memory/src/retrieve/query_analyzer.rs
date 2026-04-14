//! Internal query analyzer for `QueryMemory`.
//!
//! The analyzer converts raw request fields into a structured retrieval context
//! while keeping a clear fallback path when analysis fails.

use anyhow::{Result, bail};
use std::collections::BTreeSet;

use crate::retrieve::types::domain_class;

const INTENT_RECALL: &str = "recall";
const INTENT_COMPARE: &str = "compare";
const INTENT_DISAMBIGUATE: &str = "disambiguate";
const INTENT_CORRECT: &str = "correct";
const INTENT_EXPLAIN: &str = "explain";
const INTENT_DECIDE: &str = "decide";
const INTENT_NONE: &str = "none";

const TARGET_GENERAL: &str = "general";
const TARGET_PREFERENCE: &str = "preference";
const TARGET_FACT: &str = "fact";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QueryAnalysis {
    pub domain_classes: Vec<String>,
    pub entities: Vec<String>,
    pub relation_types: Vec<String>,
    pub intent_type: String,
    pub intent_aux: Vec<String>,
    pub recall_target_type: Option<String>,
}

impl QueryAnalysis {
    pub fn fallback(domain_class_input: &str, query_text: &str) -> Self {
        let normalized_domain_class = normalize_domain_class(domain_class_input);
        let recall_target_type = detect_recall_target_type(query_text)
            .map(str::to_string)
            .or(Some(TARGET_GENERAL.to_string()));

        Self {
            domain_classes: vec![normalized_domain_class],
            entities: Vec::new(),
            relation_types: Vec::new(),
            intent_type: INTENT_NONE.to_string(),
            intent_aux: Vec::new(),
            recall_target_type,
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct QueryAnalyzer;

impl QueryAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub fn analyze(
        &self,
        query_text: &str,
        domain_class_input: &str,
        session_id: &str,
    ) -> Result<QueryAnalysis> {
        if !session_id.trim().is_empty() {
            uuid::Uuid::parse_str(session_id)
                .map_err(|e| anyhow::anyhow!("invalid session_id for query analyzer: {e}"))?;
        }

        let normalized_query = query_text.trim();
        let normalized_domain_class = normalize_domain_class(domain_class_input);
        let intent_type = detect_intent_type(normalized_query);
        if !is_supported_intent(&intent_type) {
            bail!("unsupported intent_type: {intent_type}");
        }

        let recall_target_type = if intent_type == INTENT_RECALL {
            detect_recall_target_type(normalized_query).map(str::to_string)
        } else {
            detect_recall_target_type(normalized_query)
                .filter(|target| *target != TARGET_GENERAL)
                .map(str::to_string)
        };

        let mut domain_classes = BTreeSet::new();
        domain_classes.insert(normalized_domain_class);

        let entities = extract_entities(normalized_query);
        let relation_types = detect_relation_types(normalized_query, &intent_type);
        let intent_aux = detect_intent_aux(normalized_query, session_id, &intent_type, &relation_types);

        Ok(QueryAnalysis {
            domain_classes: domain_classes.into_iter().collect(),
            entities,
            relation_types,
            intent_type,
            intent_aux,
            recall_target_type,
        })
    }
}

fn normalize_domain_class(input: &str) -> String {
    let trimmed = input.trim();
    if domain_class::is_valid(trimmed) {
        trimmed.to_string()
    } else {
        domain_class::default().to_string()
    }
}

fn detect_intent_type(query_text: &str) -> String {
    let lower = query_text.to_lowercase();

    if contains_any(&lower, &["remember", "recall", "previously", "before", "之前", "还记得", "聊过"]) {
        return INTENT_RECALL.to_string();
    }
    if contains_any(&lower, &["compare", "difference", "versus", "vs", "区别", "比较"]) {
        return INTENT_COMPARE.to_string();
    }
    if contains_any(&lower, &["which one", "还是", "到底是", "弄混", "disambiguate"]) {
        return INTENT_DISAMBIGUATE.to_string();
    }
    if contains_any(&lower, &["correct", "wrong", "不对", "纠正", "更正"]) {
        return INTENT_CORRECT.to_string();
    }
    if contains_any(&lower, &["explain", "why", "how", "解释", "说明"]) {
        return INTENT_EXPLAIN.to_string();
    }
    if contains_any(&lower, &["decide", "choose", "option", "选择", "决定", "方案"]) {
        return INTENT_DECIDE.to_string();
    }

    INTENT_NONE.to_string()
}

fn detect_recall_target_type(query_text: &str) -> Option<&'static str> {
    let lower = query_text.to_lowercase();

    if contains_any(&lower, &["preference", "prefer", "偏好", "倾向"]) {
        return Some(TARGET_PREFERENCE);
    }
    if contains_any(&lower, &["fact", "事实", "约束", "constraint"]) {
        return Some(TARGET_FACT);
    }
    if query_text.trim().is_empty() {
        return None;
    }

    Some(TARGET_GENERAL)
}

fn detect_relation_types(query_text: &str, intent_type: &str) -> Vec<String> {
    let lower = query_text.to_lowercase();
    let mut relation_types = BTreeSet::new();

    if intent_type == INTENT_COMPARE || contains_any(&lower, &["compare", "difference", "versus", "vs", "比较", "区别"]) {
        relation_types.insert("comparison".to_string());
    }
    if intent_type == INTENT_DISAMBIGUATE || contains_any(&lower, &["还是", "到底是", "弄混", "disambiguate"]) {
        relation_types.insert("disambiguation".to_string());
    }
    if intent_type == INTENT_CORRECT || contains_any(&lower, &["correct", "wrong", "不对", "纠正", "更正"]) {
        relation_types.insert("correction".to_string());
    }

    relation_types.into_iter().collect()
}

fn detect_intent_aux(
    query_text: &str,
    session_id: &str,
    intent_type: &str,
    relation_types: &[String],
) -> Vec<String> {
    let lower = query_text.to_lowercase();
    let mut aux = BTreeSet::new();

    if intent_type == INTENT_RECALL && session_id.trim().is_empty() {
        aux.insert("cross_session_scope".to_string());
    }
    if intent_type == INTENT_RECALL
        && contains_any(&lower, &["latest", "recent", "最近", "刚才"])
    {
        aux.insert("recent_bias".to_string());
    }
    if intent_type == INTENT_DECIDE
        && !relation_types.iter().any(|relation| relation == "comparison")
    {
        aux.insert("decision_context".to_string());
    }

    aux.into_iter().collect()
}

fn extract_entities(query_text: &str) -> Vec<String> {
    let mut entities = BTreeSet::new();

    for token in query_text.split(|c: char| !c.is_alphanumeric() && c != '_' && c != '-') {
        if token.chars().count() < 2 {
            continue;
        }

        let starts_uppercase = token.chars().next().is_some_and(|c| c.is_uppercase());
        let is_ascii_word = token.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_');

        if starts_uppercase && is_ascii_word {
            entities.insert(token.to_string());
        }
    }

    entities.into_iter().collect()
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(needle))
}

fn is_supported_intent(intent_type: &str) -> bool {
    matches!(
        intent_type,
        INTENT_RECALL
            | INTENT_COMPARE
            | INTENT_DISAMBIGUATE
            | INTENT_CORRECT
            | INTENT_EXPLAIN
            | INTENT_DECIDE
            | INTENT_NONE
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analyze_returns_structured_context() {
        let analyzer = QueryAnalyzer::new();

        let analysis = analyzer
            .analyze(
                "Do you remember whether Karl Marx or Friedrich Engels was mentioned before?",
                "history",
                "",
            )
            .unwrap();

        assert_eq!(analysis.domain_classes, vec!["history".to_string()]);
        assert_eq!(analysis.intent_type, "recall");
        assert!(analysis.entities.contains(&"Karl".to_string()));
        assert!(analysis.entities.contains(&"Marx".to_string()));
        assert!(analysis.entities.contains(&"Friedrich".to_string()));
        assert!(analysis.entities.contains(&"Engels".to_string()));
        assert!(analysis.intent_aux.contains(&"cross_session_scope".to_string()));
        assert_eq!(analysis.recall_target_type.as_deref(), Some("general"));
    }

    #[test]
    fn analyze_detects_relation_without_dup_aux() {
        let analyzer = QueryAnalyzer::new();

        let analysis = analyzer
            .analyze("Compare Rust vs Go for backend services", "technology", "")
            .unwrap();

        assert_eq!(analysis.intent_type, "compare");
        assert_eq!(analysis.relation_types, vec!["comparison".to_string()]);
        assert!(analysis.intent_aux.is_empty());
    }

    #[test]
    fn analyze_rejects_invalid_session_id() {
        let analyzer = QueryAnalyzer::new();

        let result = analyzer.analyze("remember this", "chat", "not-a-uuid");
        assert!(result.is_err());
    }

    #[test]
    fn fallback_normalizes_domain_class() {
        let fallback = QueryAnalysis::fallback("not-real", "Need the latest preference");
        assert_eq!(fallback.domain_classes, vec!["chat".to_string()]);
        assert_eq!(fallback.intent_type, "none");
        assert_eq!(fallback.recall_target_type.as_deref(), Some("preference"));
    }
}
