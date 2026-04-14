//! Shared query/storage semantics for anchored retrieval.

use std::collections::BTreeSet;

const INTENT_AUX_CROSS_SESSION_SCOPE: &str = "cross_session_scope";
const INTENT_AUX_RECENT_BIAS: &str = "recent_bias";
const INTENT_AUX_DECISION_CONTEXT: &str = "decision_context";

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum QueryIntentType {
    Recall,
    Compare,
    Disambiguate,
    Correct,
    Explain,
    Decide,
    None,
}

impl QueryIntentType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Recall => "recall",
            Self::Compare => "compare",
            Self::Disambiguate => "disambiguate",
            Self::Correct => "correct",
            Self::Explain => "explain",
            Self::Decide => "decide",
            Self::None => "none",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum DiscourseAction {
    RecallPrompt,
    Comparison,
    Disambiguation,
    Correction,
    Explanation,
    Decision,
    Other,
}

impl DiscourseAction {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::RecallPrompt => "recall_prompt",
            Self::Comparison => "comparison",
            Self::Disambiguation => "disambiguation",
            Self::Correction => "correction",
            Self::Explanation => "explanation",
            Self::Decision => "decision",
            Self::Other => "other",
        }
    }
}

pub fn map_intent_to_discourse_action(intent: QueryIntentType) -> Option<DiscourseAction> {
    match intent {
        QueryIntentType::Recall => Some(DiscourseAction::RecallPrompt),
        QueryIntentType::Compare => Some(DiscourseAction::Comparison),
        QueryIntentType::Disambiguate => Some(DiscourseAction::Disambiguation),
        QueryIntentType::Correct => Some(DiscourseAction::Correction),
        QueryIntentType::Explain => Some(DiscourseAction::Explanation),
        QueryIntentType::Decide => Some(DiscourseAction::Decision),
        QueryIntentType::None => None,
    }
}

pub fn infer_discourse_actions(text: &str) -> Vec<DiscourseAction> {
    let lower = text.trim().to_lowercase();
    if lower.is_empty() {
        return vec![DiscourseAction::Other];
    }

    let mut actions = BTreeSet::new();

    if contains_any(
        &lower,
        &["remember", "recall", "previously", "before", "之前", "还记得", "聊过"],
    ) {
        actions.insert(DiscourseAction::RecallPrompt);
    }
    if contains_any(
        &lower,
        &["compare", "difference", "versus", "vs", "区别", "比较"],
    ) {
        actions.insert(DiscourseAction::Comparison);
    }
    if contains_any(
        &lower,
        &["which one", "还是", "到底是", "弄混", "disambiguate"],
    ) {
        actions.insert(DiscourseAction::Disambiguation);
    }
    if contains_any(
        &lower,
        &["correct", "wrong", "不对", "纠正", "更正"],
    ) {
        actions.insert(DiscourseAction::Correction);
    }
    if contains_any(
        &lower,
        &["explain", "why", "how", "解释", "说明"],
    ) {
        actions.insert(DiscourseAction::Explanation);
    }
    if contains_any(
        &lower,
        &["decide", "choose", "option", "选择", "决定", "方案"],
    ) {
        actions.insert(DiscourseAction::Decision);
    }

    if actions.is_empty() {
        vec![DiscourseAction::Other]
    } else {
        actions.into_iter().collect()
    }
}

pub fn normalize_intent_aux(intent_aux: Vec<String>, relation_types: &[String]) -> Vec<String> {
    let relation_set = relation_types
        .iter()
        .map(|value| value.trim().to_lowercase())
        .collect::<BTreeSet<_>>();

    intent_aux
        .into_iter()
        .filter_map(|value| {
            let normalized = value.trim().to_lowercase();
            (!normalized.is_empty() && !relation_set.contains(&normalized)).then_some(normalized)
        })
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

pub fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(needle))
}

pub const fn intent_aux_cross_session_scope() -> &'static str {
    INTENT_AUX_CROSS_SESSION_SCOPE
}

pub const fn intent_aux_recent_bias() -> &'static str {
    INTENT_AUX_RECENT_BIAS
}

pub const fn intent_aux_decision_context() -> &'static str {
    INTENT_AUX_DECISION_CONTEXT
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn intent_to_discourse_mapping_is_stable() {
        assert_eq!(
            map_intent_to_discourse_action(QueryIntentType::Recall),
            Some(DiscourseAction::RecallPrompt)
        );
        assert_eq!(
            map_intent_to_discourse_action(QueryIntentType::Compare),
            Some(DiscourseAction::Comparison)
        );
        assert_eq!(
            map_intent_to_discourse_action(QueryIntentType::Disambiguate),
            Some(DiscourseAction::Disambiguation)
        );
        assert_eq!(
            map_intent_to_discourse_action(QueryIntentType::Correct),
            Some(DiscourseAction::Correction)
        );
        assert_eq!(
            map_intent_to_discourse_action(QueryIntentType::Explain),
            Some(DiscourseAction::Explanation)
        );
        assert_eq!(
            map_intent_to_discourse_action(QueryIntentType::Decide),
            Some(DiscourseAction::Decision)
        );
        assert_eq!(map_intent_to_discourse_action(QueryIntentType::None), None);
    }

    #[test]
    fn infer_discourse_actions_defaults_to_other() {
        assert_eq!(infer_discourse_actions(""), vec![DiscourseAction::Other]);
        assert_eq!(
            infer_discourse_actions("Need a concise rollout checklist"),
            vec![DiscourseAction::Other]
        );
    }

    #[test]
    fn infer_discourse_actions_collects_closed_set_values() {
        assert_eq!(
            infer_discourse_actions("Compare Rust vs Go and explain why"),
            vec![DiscourseAction::Comparison, DiscourseAction::Explanation]
        );
    }

    #[test]
    fn normalize_intent_aux_deduplicates_relation_overlap() {
        let normalized = normalize_intent_aux(
            vec![
                "comparison".to_string(),
                "recent_bias".to_string(),
                "recent_bias".to_string(),
            ],
            &["comparison".to_string()],
        );

        assert_eq!(normalized, vec!["recent_bias".to_string()]);
    }
}
