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
