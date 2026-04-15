pub fn is_quality_summary(summary: &str) -> bool {
    let normalized = summary.trim();
    if normalized.chars().count() < 24 {
        return false;
    }

    let lower = normalized.to_lowercase();
    let has_template_session_prefix =
        lower.starts_with("session '") && lower.contains("summary (") && lower.contains("messages):");

    !has_template_session_prefix
        && ![
            "summary task already accepted",
            "accepted for session",
            "pending",
            "n/a",
            "todo",
        ]
        .iter()
        .any(|marker| lower.contains(marker))
}

#[cfg(test)]
mod tests {
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
}
