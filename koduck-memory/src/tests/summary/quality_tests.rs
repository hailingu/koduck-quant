use super::is_quality_summary;

#[test]
fn rejects_placeholder_and_template_summaries() {
    assert!(!is_quality_summary("summary task already accepted for session 123"));
    assert!(!is_quality_summary("todo"));
    assert!(!is_quality_summary(
        "Session 'untitled' summary (history, 8 messages): user: foo | assistant: bar"
    ));
}

#[test]
fn accepts_concise_but_real_summary() {
    assert!(is_quality_summary(
        "讨论了沙逊洋行相关内容，包括创始人、代表建筑和上海地产布局。"
    ));
}
